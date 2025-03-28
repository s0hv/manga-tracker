import os

import sentry_sdk

from src import setup_logging
from src.scheduler import UpdateScheduler
from src.utils.utilities import utcnow

logger = setup_logging.setup()

if 'SENTRY_URL' in os.environ:
    sentry_sdk.init(
        os.environ['SENTRY_URL'],
        traces_sample_rate=1.0
    )
else:
    logger.info('Skipping sentry initialization')

scheduler = UpdateScheduler()
try:
    logger.debug("Next update in %s", scheduler.run_once()-utcnow())
except Exception:
    logger.exception('Failed to run once')

scheduler.es.close()
scheduler.pool.close()
sentry_sdk.flush()
