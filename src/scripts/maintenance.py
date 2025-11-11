import logging
import os
from argparse import ArgumentParser

from src import setup_logging
from src.scheduler import DbUtil, UpdateScheduler

if __name__ == '__main__':
    setup_logging.setup()
    logger = logging.getLogger(__name__)

    parser = ArgumentParser()
    parser.add_argument('--manga', '-m', type=int, required=True)
    parser.add_argument('--update-interval', '-ui', action='store_true')
    parser.add_argument('--update-estimate', '-ue', action='store_true')
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
        dbutil = DbUtil(conn, None)
        try:
            with conn.cursor() as cur:
                if args.update_interval:
                    logger.info(f'Updating interval for {args.manga}')
                    dbutil.update_chapter_interval(args.manga, cur=cur)

                if args.update_estimate:
                    logger.info(f'Updating estimate for {args.manga}')
                    dbutil.update_estimated_release(args.manga, cur=cur)

        except Exception:
            logger.exception('Failed to execute commands. Rolling back')
            conn.rollback()
            raise

        print('Commit changes? (y/n)')
        resp = input().strip().lower()
        if resp in ('y', 'yes'):
            print('Committing changes')
            conn.commit()
        else:
            print('Rolling back changes')
            conn.rollback()
