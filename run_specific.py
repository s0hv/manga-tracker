import logging
import sys
from argparse import ArgumentParser

from src.scheduler import UpdateScheduler

parser = ArgumentParser()
parser.add_argument('--service', type=int, nargs='?', required=True)
parser.add_argument('--manga', type=int, nargs='?', required=False, default=None)

args = parser.parse_args()
print(args)

logger = logging.getLogger('debug')
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter('[{module}][{asctime}] [Thread: {thread}] [{levelname}]:{message}', datefmt='%Y-%m-%d %H:%M:%S', style='{'))
logger.addHandler(handler)

scheduler = UpdateScheduler()
scheduler.force_run(args.service, args.manga)
