import argparse  # noqa: INP001 This is a script and not a module
from operator import itemgetter
from time import sleep

import requests

from src.db.utilities import execute_values
from src.scheduler import UpdateScheduler


def fetch_ids(type_: str, ids: list[str]) -> dict:
    url = 'https://api.mangadex.org/legacy/mapping'
    try:
        r = requests.post(url, json={
            'type': type_,
            'ids': list(map(int, ids))
        })
    # If fail try again
    except requests.exceptions.ConnectionError:
        sleep(5)
        r = requests.post(url, json={
            'type': type_,
            'ids': list(map(int, ids))
        })

    if not r.ok:
        print(r)
        print(r.content)
        raise Exception('Not ok')

    return r.json()


def migrate_chapters(delete: bool=False) -> None:
    chapter_sql = 'SELECT chapter_identifier FROM chapters WHERE service_id=2'

    # Easiest way to get a new connection
    scheduler = UpdateScheduler()
    with scheduler.conn() as conn:
        with conn.cursor() as cur:
            cur.execute(chapter_sql)
            chapters = cur.fetchall()

    chunk_size = 700
    update_chapter_sql = (
        'UPDATE chapters c SET chapter_identifier=v.new_id '
        'FROM (VALUES %s) as v(new_id, old_id) '
        'WHERE service_id=2 AND c.chapter_identifier=v.old_id'
    )

    def isdigit(r: dict) -> bool:
        return r['chapter_identifier'].isdigit()

    chapters = list(filter(isdigit, chapters))

    if delete:
        format_args = ','.join(('%s',) * len(chapters))
        sql = f'DELETE FROM chapters WHERE service_id=2 AND chapter_identifier IN ({format_args})'
        with scheduler.conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, list(map(itemgetter('chapter_identifier'), chapters)))

        print(f'Deleted {len(chapters)} chapters')
        return

    print(f'Updating {len(chapters)} chapters')
    for i in range(0, len(chapters), chunk_size):
        print(i)
        chapter_chunk = chapters[i:i + chunk_size]
        identifiers = map(itemgetter('chapter_identifier'), chapter_chunk)
        mapping = fetch_ids('chapter', identifiers)

        args = []
        for m in mapping:
            attrs = m['data']['attributes']
            args.append((attrs['newId'], str(attrs['legacyId'])))

        with scheduler.conn() as conn:
            with conn.cursor() as cur:
                execute_values(cur, update_chapter_sql, args,
                               page_size=chunk_size)

        sleep(3)


def migrate_manga(delete: bool=False) -> None:
    manga_sql = 'SELECT title_id FROM manga_service WHERE service_id=2'
    # Easiest way to get a new connection
    scheduler = UpdateScheduler()
    with scheduler.conn() as conn:
        with conn.cursor() as cur:
            cur.execute(manga_sql)
            manga = cur.fetchall()

    chunk_size = 700
    update_manga_sql = (
        'UPDATE manga_service m SET title_id=v.new_id '
        'FROM (VALUES %s) as v(new_id, old_id) '
        'WHERE service_id=2 AND m.title_id=v.old_id'
    )

    def isdigit(r: dict) -> bool:
        return r['title_id'].isdigit()

    manga = list(filter(isdigit, manga))
    if delete:
        format_args = ','.join(('%s',)*len(manga))
        sql = f'DELETE FROM manga_service WHERE service_id=2 AND title_id IN ({format_args})'
        with scheduler.conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, list(map(itemgetter('title_id'), manga)))

        print(f'Deleted {len(manga)} manga')
        return

    print(f'Updating {(len(manga))} manga')
    for i in range(0, len(manga), chunk_size):
        print(i)
        manga_chunk = manga[i:i + chunk_size]
        identifiers = map(itemgetter('title_id'), manga_chunk)
        mapping = fetch_ids('manga', identifiers)

        args = []
        for m in mapping:
            attrs = m['data']['attributes']
            args.append((attrs['newId'], str(attrs['legacyId'])))

        with scheduler.conn() as conn:
            with conn.cursor() as cur:
                execute_values(cur, update_manga_sql, args,
                               page_size=chunk_size)

        sleep(3)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--delete', default=False, action='store_true',
                        help='Deletes all mangadex manga and chapters with integer ids if set')

    parsed = parser.parse_args()

    migrate_chapters(parsed.delete)
    migrate_manga(parsed.delete)
