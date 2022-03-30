import logging
import os
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

    db_logger = logging.getLogger('database')
    if os.environ.get('LEVEL'):
        db_logger.setLevel(os.environ.get('LEVEL'))
    else:
        db_logger.setLevel(logging.WARNING)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LoggingFormatter(
        '{color}[{module}][{asctime}] [Thread: {thread}] [{levelname}]:{colorend} {message}',
        datefmt='%Y-%m-%d %H:%M:%S', style='{'))
    db_logger.addHandler(handler)

    discord_webhook_logging = logging.getLogger('webhook')
    if os.environ.get('LEVEL'):
        discord_webhook_logging.setLevel(os.environ.get('LEVEL'))
    else:
        discord_webhook_logging.setLevel(logging.WARNING)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LoggingFormatter(
        '{color}[{module}][{asctime}] [Thread: {thread}] [{levelname}]:{colorend} {message}',
        datefmt='%Y-%m-%d %H:%M:%S', style='{'))
    discord_webhook_logging.addHandler(handler)

    return logger
