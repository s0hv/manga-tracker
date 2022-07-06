from argparse import ArgumentParser

import setup_logging
from src.scheduler import UpdateScheduler

parser = ArgumentParser()
parser.add_argument('--service', type=int, nargs='?', required=True)
parser.add_argument('--manga', type=int, nargs='?', required=False, default=None)

args = parser.parse_args()
print(args)

setup_logging.setup()

scheduler = UpdateScheduler()
scheduler.force_run(args.service, args.manga)

scheduler.es.close()
scheduler.pool.closeall()
