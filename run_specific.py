import logging
from argparse import ArgumentParser

from src import setup_logging
from src.scheduler import UpdateScheduler

logger = logging.getLogger(__name__)

parser = ArgumentParser()
parser.add_argument('--service', type=int, nargs='?', required=True)
parser.add_argument('--manga', type=int, nargs='?', required=False, default=None)

args = parser.parse_args()
print(args)

setup_logging.setup()

scheduler = UpdateScheduler()
try:
    scheduler.force_run(args.service, args.manga)
except Exception:
    logger.exception('Failed to run update')

scheduler.es.close()
scheduler.pool.close()
