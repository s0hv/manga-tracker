import json
import os
from datetime import datetime, timezone

from src.scheduler import UpdateScheduler

with open(os.path.join('config', 'config.json'), encoding='utf-8') as f:
    config = json.load(f)

scheduler = UpdateScheduler()
print((scheduler.run_once()-datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(tz=timezone.utc)))
