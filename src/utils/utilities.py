import logging
import random
import re
from collections.abc import Iterable
from datetime import datetime, time, timedelta, timezone
from typing import TYPE_CHECKING, NoReturn

from feedparser import FeedParserDict
from psycopg.rows import DictRow

from src.errors import FeedHttpError, InvalidFeedError

if TYPE_CHECKING:
    # noinspection PyUnresolvedReferences
    from src.utils.dbutils import DbUtil

logger = logging.getLogger('debug')

type FeedType = FeedParserDict[str, bool | list | FeedParserDict | dict]

chapter_regex = re.compile(r'(\d+)(\.\d+)?')
universal_chapter_regex = \
    re.compile(r'(?P<manga_title>.+?)(?: -)? +'
               r'(?:(?:Volume|Vol) (?P<volume_number>\d+),? ?)?'  # Try to match volume number
               
               # Check for chapter number if one exists
               r'(?:'  
                   r'((Chapter) ?(?P<chapter>\d+)(?:\.(?P<decimal>\d))?,?)|'  # Match chapter number in the format of Chapter x.y
                   r'((?=Oneshot))|'  # Check if oneshot. Those won't have a defined chapter number
                   # Broad chapter number lookup. Matches any string following a number as long as it's preceded by a space or : and doesn't have a chapter after it
                   r'([^ \d]+?.(?P<chapter_number2>\d+)(?:\.(?P<chapter_decimal2>\d))?(?=[ :])(?!.+? chapter))'
               r'):? ?'
               # Match title if one exists
               r'(?P<chapter_title>.+?)?$',
               re.IGNORECASE)


def match_title(s: str) -> dict[str, str] | None:
    match = universal_chapter_regex.match(s)
    if not match:
        return None

    match = match.groupdict()
    match['chapter_number'] = match.pop('chapter') or match.pop('chapter_number2')
    match['decimal'] = match['decimal'] or match.pop('chapter_decimal2')
    logger.debug(f'Parsed title with universal regex: {match}')
    return match


def parse_chapter_number(chapter_number: str) -> tuple[str | None, str | None]:
    match = chapter_regex.match(chapter_number)
    if not match:
        return None, None

    n, d = match.groups()
    if d:
        d = d[1:]

    return n, d


def round_seconds(sec: float, accuracy: int) -> int:
    left = sec % accuracy
    sec -= left
    if left > accuracy//2:
        return int(sec)+accuracy
    return int(sec)


def random_timedelta(low: timedelta | int, high: timedelta | int) -> timedelta:
    """
    Args:
        low (timedelta or int): Lower bound of the time as timedelta or seconds
        high (timedelta or int): Upper bound of the time as timedelta or seconds

    Returns:
        timedelta: A random timedelta between low and high
    """

    if isinstance(low, timedelta):
        low = int(low.total_seconds())
    if isinstance(high, timedelta):
        high = int(high.total_seconds())

    return timedelta(seconds=random.randint(low, high))


def is_valid_feed(feed: FeedType) -> NoReturn | None:
    if hasattr(feed, 'status') and feed.status != 200:
        raise FeedHttpError(f'Failed to get feed. Status: {feed.status}')

    if feed.bozo:
        raise InvalidFeedError('Invalid feed returned', feed.bozo_exception)

    return None


def get_latest_chapters(rows: Iterable[dict | DictRow]) -> dict[str, tuple[int, int, datetime]]:
    """
    From a set of rows get the ones with the highest chapter number and smallest release date
    Args:
        rows: A result row or iterable of dicts

    Returns:
        dict: of rows with the highest chapter number and smallest release date for a single manga
    """
    chapter_data: dict[str, tuple[int, int, datetime]] = {}
    for row in rows:
        if row['chapter_decimal'] is not None:
            continue
        manga_id = row['manga_id']
        if manga_id in chapter_data and (
            chapter_data[manga_id][1] > row['chapter_number']
            or chapter_data[manga_id][2] > row['release_date']
        ):
            continue

        chapter_data[manga_id] = (row['manga_id'], row['chapter_number'], row['release_date'])

    return chapter_data


def inject_service_values(dbutil: 'DbUtil') -> None:
    """
    Injects configs and other possible values into scraper class variables.
    Must be run before instantiating any scraper
    """
    configs = dbutil.get_service_configs()
    from src.scrapers import SCRAPERS_ID
    for config in configs:
        Service = SCRAPERS_ID.get(config.service_id)
        if Service is not None:
            Service.CONFIG = config


def remove_chapter_prefix(title: str) -> str:
    return re.sub(r'^chapter \d+(\.\d+)?( *[:\-;]? +|$)', '', title, flags=re.I)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcfromtimestamp(t: int | float) -> datetime:
    return datetime.fromtimestamp(t, timezone.utc)


def utctoday() -> datetime:
    return datetime.combine(utcnow(), time(), timezone.utc)
