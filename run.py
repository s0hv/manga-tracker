from datetime import datetime, timezone
import os

import sentry_sdk

import setup_logging
from src.scheduler import UpdateScheduler

sentry_sdk.init(
    os.environ['SENTRY_URL'],
    traces_sample_rate=1.0
)

logger = setup_logging.setup()
scheduler = UpdateScheduler()
logger.debug("Next update in %s", scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc))
