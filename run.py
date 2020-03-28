from datetime import datetime, timezone

import setup_logging
from src.scheduler import UpdateScheduler

setup_logging.setup()

scheduler = UpdateScheduler()
print((scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc)))
