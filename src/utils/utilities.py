import re
import statistics
from datetime import timedelta

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


if __name__ == '__main__':
    from src.scheduler import UpdateScheduler

    import json
    import os

    with open(os.path.join('..', '..', 'config', 'config.json'), encoding='utf-8') as f:
        config = json.load(f)

    scheduler = UpdateScheduler(config)
    with scheduler.conn.cursor() as cursor:
        update_chapter_interval(cursor, 1)
    scheduler.conn.commit()