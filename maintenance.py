import os
from argparse import ArgumentParser

import setup_logging
from src.scheduler import UpdateScheduler, DbUtil

logger = setup_logging.setup()

parser = ArgumentParser()
parser.add_argument('--update-interval', '-ui', type=int)
parser.add_argument('--production', '-p', action='store_true')

args = parser.parse_args()

if args.production:
    logger.warning('using production environment. Type yes to continue')
    resp = input()
    if resp.lower().strip() != 'yes':
        logger.info('Cancelling')
        exit()

    os.environ['DB_HOST'] = os.environ['DB_HOST_PROD']
    os.environ['DB_PASSWORD'] = os.environ['DB_PASSWORD_PROD']

scheduler = UpdateScheduler()
with scheduler.conn() as conn:
    dbutil = DbUtil(conn)
    with conn.cursor() as cur:
        if args.update_interval:
            logger.info(f'Updating interval for {args.update_interval}')
            dbutil.update_chapter_interval(cur, args.update_interval)

    print('Commit changes? (y/n)')
    resp = input().strip().lower()
    if resp in ('y', 'yes'):
        print('Committing changes')
        conn.commit()
    else:
        print('Rolling back changes')
        conn.rollback()
