from src.scheduler import UpdateScheduler

import json
import os


with open(os.path.join('config', 'config.json'), encoding='utf-8') as f:
    config = json.load(f)

scheduler = UpdateScheduler(config)
scheduler.schedule_loop()
