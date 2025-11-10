import logging
import os
import sys

from src.utils.formatter import LoggingFormatter


def setup(name: str = 'debug') -> logging.Logger:
    formatter = LoggingFormatter(
            '{color}[{module}][{asctime}.{msecs:.0f}] [Thread: {thread}] [{levelname}]:{colorend} {message}',
            datefmt='%Y-%m-%d %H:%M:%S',
            style='{',
        )

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    db_logger = logging.getLogger('database')
    if level := os.environ.get('LEVEL'):
        db_logger.setLevel(level)
    else:
        db_logger.setLevel(logging.WARNING)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LoggingFormatter(
        '{color}[{originalmodule}][{asctime}.{msecs:.0f}] [Thread: {thread}] [{levelname}]:{colorend} {message}',
        datefmt='%Y-%m-%d %H:%M:%S',
        style='{',
    ))
    db_logger.addHandler(handler)

    discord_webhook_logging = logging.getLogger('webhook')
    if level:
        discord_webhook_logging.setLevel(level)
    else:
        discord_webhook_logging.setLevel(logging.WARNING)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    discord_webhook_logging.addHandler(handler)

    return logger
