from datetime import datetime, timezone

import setup_logging
from src.scheduler import UpdateScheduler

logger = setup_logging.setup()

scheduler = UpdateScheduler()
logger.debug("Next update in %s", scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc))
