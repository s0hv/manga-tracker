import logging
import re
import statistics
from datetime import timedelta, datetime

from psycopg2.extras import execute_values

logger = logging.getLogger('debug')

chapter_regex = re.compile(r'(\d+)(\.\d+)?')


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

    for row in cur:
        if row[2] == 1:
            yield row[0], manga_titles.pop(row[1])
            continue

        logger.warning(f'Too many matches for manga {row[1]}')

    if not manga_titles:
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
    now = datetime.utcnow()
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


if __name__ == '__main__':
    from src.scheduler import UpdateScheduler

    scheduler = UpdateScheduler()
    with scheduler.conn.cursor() as cursor:
        update_chapter_interval(cursor, 8)
    scheduler.conn.commit()
