import os
from datetime import datetime, timezone

import sentry_sdk

import setup_logging
from src.scheduler import UpdateScheduler

logger = setup_logging.setup()

if 'SENTRY_URL' in os.environ:
    sentry_sdk.init(
        os.environ['SENTRY_URL'],
        traces_sample_rate=1.0
    )
else:
    logger.info('Skipping sentry initialization')

scheduler = UpdateScheduler()
logger.debug("Next update in %s", scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc))

scheduler.es.close()
scheduler.pool.closeall()
sentry_sdk.flush()
