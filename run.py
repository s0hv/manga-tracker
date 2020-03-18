from datetime import datetime, timezone

from src.scheduler import UpdateScheduler

scheduler = UpdateScheduler()
print((scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc)))
