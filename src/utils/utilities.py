import logging
import re

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

