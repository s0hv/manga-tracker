import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.blocking import BlockingScheduler
from pytz import utc

import setup_logging
from src.scheduler import UpdateScheduler

setup_logging.setup()
logger = logging.getLogger('debug')

scheduler = BlockingScheduler(timezone=utc, logger=logger)
JOB_ID = 'MANGA_UPDATE'


def update_manga():
    logger.info('Checking manga')
    manga_updater = UpdateScheduler()
    next_update = None
    try:
        next_update = manga_updater.run_once()
    except:
        logger.exception('Failed to get manga')
        next_update = datetime.utcnow() + timedelta(hours=1)
    finally:
        scheduler.add_job(update_manga, 'date', id=JOB_ID, run_date=next_update)


job = scheduler.add_job(update_manga, 'date', id=JOB_ID, run_date=datetime.utcnow())

scheduler.start()
