import logging
import re
import statistics
from datetime import timedelta, datetime

from psycopg2.extras import execute_values

logger = logging.getLogger('debug')

chapter_regex = re.compile(r'(\d+)(\.\d+)?')
universal_chapter_regex = \
    re.compile(r'(?P<manga_title>.+?)(?: -)? +'
               r'(?:(?:Volume|Vol) (?P<volume_number>\d+),? ?)?'  # Try to match volume number
               
               # Check for chapter number if one exists
               r'(?:'  
                   r'(?:(?:Chapter) ?(?P<chapter_number>\d+)(?:\.(?P<chapter_decimal>\d))?,?)|'  # Match chapter number in the format of Chapter x.y
                   r'(?: ?(?=Oneshot))|'  # Check if oneshot. Those won't have a defined chapter number
                   # Broad chapter number lookup. Matches any string following a number as long as it's preceded by a space or : and doesn't have a chapter after it
                   r'(?:[^ \d]+?.(?P<chapter_number2>\d+)(?:\.(?P<chapter_decimal2>\d))?(?=[ :])(?!.+? chapter))'
               r'):? ?'
               # Match title if one exists
               r'(?P<chapter_title>.+?)?$',
               re.IGNORECASE)


def match_title(s: str):
    match = universal_chapter_regex.match(s)
    if not match:
        return

    match = match.groupdict()
    match['chapter_number'] = match['chapter_number'] or match.pop('chapter_number2')
    match['chapter_decimal'] = match['chapter_decimal'] or match.pop('chapter_decimal2')
    logger.debug(f"Parsed title with universal regex: {match}")
    return match


def parse_chapter_number(chapter_number: str):
    match = chapter_regex.match(chapter_number)
    if not match:
        return None, None

    n, d = match.groups()
    if d:
        d = d[1:]

    return n, d


def round_seconds(sec, accuracy):
    left = sec % accuracy
    sec -= left
    if left > accuracy//2:
        return sec+accuracy
    return sec


def update_chapter_interval(cur, manga_id):
    sql = 'SELECT MIN(release_date) release_date, chapter_number FROM chapters WHERE manga_id=%s GROUP BY chapter_number ORDER BY chapter_number DESC LIMIT 30'
    cur.execute(sql, (manga_id,))
    chapters = []
    last = None
    for c in cur:
        if not last:
            last = c
            chapters.append(c)
            continue

        if last['chapter_number']-c['chapter_number'] > 2:
            break
        last = c
        chapters.append(c)

    if len(chapters) < 2:
        return

    intervals = []
    accuracy = 60*60*4
    for a, b in zip(chapters[:-1], chapters[1:]):
        t = a['release_date']-b['release_date']
        t = round_seconds(t.total_seconds(), accuracy)
        # Ignore updates within 4 hours of each other
        if t < accuracy:
            continue
        intervals.append(t)

    if not intervals:
        return

    try:
        interval = statistics.mode(intervals)
    except statistics.StatisticsError:
        interval = statistics.mean(intervals)
        interval = round_seconds(interval, accuracy)

    interval = timedelta(seconds=interval)
    sql = 'UPDATE manga SET release_interval=%s WHERE manga_id=%s'
    cur.execute(sql, (interval, manga_id))


def add_new_series(cur, manga_chapters: dict, service_id, disable_single_update: bool=False):
    args = []
    manga_titles = {}
    for title_id, chapters in manga_chapters.items():
        chapter = chapters[0]
        manga_title = chapter.manga_title.lower()
        args.append((manga_title,))
        manga_titles[manga_title] = chapters

    format_args = ','.join(['%s' for _ in manga_titles])
    sql = f'SELECT MIN(manga_id), LOWER(title), COUNT(manga_id) FROM manga WHERE LOWER(title) IN ({format_args}) GROUP BY LOWER(title)'

    cur.execute(sql, args)

    already_exist = []
    now = datetime.utcnow()
    for row in cur:
        if row[2] == 1:
            chapters = manga_titles.pop(row[1])
            yield row[0], chapters
            already_exist.append((row[0], service_id, chapters[0].manga_url, disable_single_update, now, chapters[0].manga_id))
            continue

        logger.warning(f'Too many matches for manga {row[1]}')

    if not manga_titles:
        sql = f'''INSERT INTO manga_service (manga_id, service_id, url, disabled, last_check, title_id) VALUES %s'''
        execute_values(cur, sql, already_exist, page_size=len(already_exist))
        return

    new_manga = []
    titles = []
    id2chapters = {}
    for chapters in manga_titles.values():
        titles.append((chapters[0].manga_title,))
        new_manga.append(chapters)

    sql = 'INSERT INTO manga (title) VALUES %s RETURNING manga_id, title'
    rows = execute_values(cur, sql, titles, page_size=len(titles), fetch=True)

    args = []
    for row, chapters in zip(rows, new_manga):
        chapter = chapters[0]
        if chapter.manga_title != row[1]:
            logger.warning(f'Inserted manga mismatch with {chapter}')
            continue

        args.append((row[0], service_id, chapter.manga_url, disable_single_update, now, chapter.manga_id))
        id2chapters[row[0]] = chapters

    sql = f'''INSERT INTO manga_service (manga_id, service_id, url, disabled, last_check, title_id) VALUES 
             %s RETURNING manga_id'''

    rows = execute_values(cur, sql, args, page_size=len(args), fetch=True)
    for row in rows:
        yield row[0], id2chapters[row[0]]


def update_service(cur, service_id, update_interval):
    sql = 'UPDATE services SET last_check=%s WHERE service_id=%s'
    now = datetime.utcnow()
    cur.execute(sql, [now, service_id])

    sql = 'UPDATE service_whole SET last_check=%s, next_update=%s WHERE service_id=%s'
    cur.execute(sql, [now, now + update_interval, service_id])


def find_added_titles(cur, title_ids):
    format_ids = ','.join(['%s'] * len(title_ids))
    sql = f'SELECT manga_id, title_id FROM manga_service WHERE title_id IN ({format_ids})'
    cur.execute(sql, title_ids)
    for row in cur:
        yield row


def update_latest_release(cur, data):
    format_ids = ','.join(['%s'] * len(data))
    sql = 'UPDATE manga m SET latest_release=c.release_date FROM ' \
          f'(SELECT MAX(release_date), manga_id FROM chapters WHERE manga_id IN ({format_ids}) GROUP BY manga_id) as c(release_date, manga_id)' \
          'WHERE m.manga_id=c.manga_id'
    cur.execute(sql, data)


if __name__ == '__main__':
    from src.scheduler import UpdateScheduler

    scheduler = UpdateScheduler()
    with scheduler.conn.cursor() as cursor:
        update_chapter_interval(cursor, 8)
    scheduler.conn.commit()
