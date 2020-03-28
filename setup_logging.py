import logging
import sys

from src.utils.formatter import LoggingFormatter


def setup(name='debug'):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LoggingFormatter(
        '{color}[{module}][{asctime}] [Thread: {thread}] [{levelname}]:{colorend} {message}',
        datefmt='%Y-%m-%d %H:%M:%S', style='{'))
    logger.addHandler(handler)
