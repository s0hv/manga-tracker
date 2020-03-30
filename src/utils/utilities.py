import logging
import random
import re
from datetime import timedelta

from src.errors import FeedHttpError, InvalidFeedError

logger = logging.getLogger('debug')

chapter_regex = re.compile(r'(\d+)(\.\d+)?')
universal_chapter_regex = \
    re.compile(r'(?P<manga_title>.+?)(?: -)? +'
               r'(?:(?:Volume|Vol) (?P<volume_number>\d+),? ?)?'  # Try to match volume number
               
               # Check for chapter number if one exists
               r'(?:'  
                   r'(?:(?:Chapter) ?(?P<chapter_number>\d+)(?:\.(?P<chapter_decimal>\d))?,?)|'  # Match chapter number in the format of Chapter x.y
                   r'(?: ?(?=Oneshot))|'  # Check if oneshot. Those won't have a defined chapter number
                   # Broad chapter number lookup. Matches any string following a number as long as it's preceded by a space or : and doesn't have a chapter after it
                   r'(?:[^ \d]+?.(?P<chapter_number2>\d+)(?:\.(?P<chapter_decimal2>\d))?(?=[ :])(?!.+? chapter))'
               r'):? ?'
               # Match title if one exists
               r'(?P<chapter_title>.+?)?$',
               re.IGNORECASE)


def match_title(s: str):
    match = universal_chapter_regex.match(s)
    if not match:
        return

    match = match.groupdict()
    match['chapter_number'] = match['chapter_number'] or match.pop('chapter_number2')
    match['chapter_decimal'] = match['chapter_decimal'] or match.pop('chapter_decimal2')
    logger.debug(f"Parsed title with universal regex: {match}")
    return match


def parse_chapter_number(chapter_number: str):
    match = chapter_regex.match(chapter_number)
    if not match:
        return None, None

    n, d = match.groups()
    if d:
        d = d[1:]

    return n, d


def round_seconds(sec, accuracy):
    left = sec % accuracy
    sec -= left
    if left > accuracy//2:
        return sec+accuracy
    return sec


def random_timedelta(low, high):
    """
    Args:
        low (timedelta or int): Lower bound of the time as timedelta or seconds
        high (timedelta or int): Upper bound of the time as timedelta or seconds

    Returns:
        timedelta: A random timedelta between low and high
    """

    if isinstance(low, timedelta):
        low = low.total_seconds()
    if isinstance(high, timedelta):
        high = high.total_seconds()

    return timedelta(seconds=random.randint(low, high))


def is_valid_feed(feed):
    if hasattr(feed, 'status'):
        if feed.status != 200:
            raise FeedHttpError(f'Failed to get feed. Status: {feed.status}')

    if feed.bozo:
        raise InvalidFeedError('Invalid feed returned', feed.bozo_exception)
