import json
import os
import unittest

import pytest

from src.utils.utilities import (universal_chapter_regex, match_title,
                                 parse_chapter_number, round_seconds,
                                 remove_chapter_prefix)


class TestUtilities(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        with open(os.path.join(os.path.dirname(__file__), 'utilities.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

    def test_regex(self):
        for case in self.test_cases:
            if not case['string']:
                continue

            match = universal_chapter_regex.match(case['string'])
            self.assertTrue(match is not None, f"Failed to match {case['string']}")
            assert match is not None

            self.assertTrue(match.groupdict() == case['correct'], f"Failed to parse {case['string']} correctly")

    def test_match_title(self):
        for case in self.test_cases:
            if not case['string']:
                continue

            match = match_title(case['string'])
            self.assertTrue(match is not None,
                            f"Failed to match {case['string']}")
            assert match is not None

            correct = case['correct'].copy()
            correct['chapter'] = correct['chapter'] or correct.pop('chapter_number2')
            correct['decimal'] = correct['decimal'] or correct.pop('chapter_decimal2')

            self.assertDictEqual(match, correct,
                                 f"Failed to parse {case['string']} correctly")


@pytest.mark.parametrize('chapter_number, correct', [
    ('1', ('1', None)),
    ('abc', (None, None)),
    ('1.5', ('1', '5')),
])
def test_parse_chapter_number(chapter_number, correct):
    assert parse_chapter_number(chapter_number) == correct


@pytest.mark.parametrize('args, correct', [
    ((0, 1), 0),
    ((50, 100), 0),
    ((51, 100), 100),
    ((150, 100), 100),
    ((151, 100), 200),
])
def test_round_seconds(args, correct):
    assert round_seconds(*args) == correct, f'round_seconds({", ".join(map(str, args))}) did not equal {correct}'


@pytest.mark.parametrize('title, correct', [
    ('chapter 1 Test', 'Test'),
    ('chapter 1     Test', 'Test'),
    ('CHAPTER 10.1', ''),
    ('test chapter 1', 'test chapter 1'),
    ('Chapter 1.', 'Chapter 1.'),
    ('Chapter 1', ''),
    ('test', 'test'),
    ('Chapter 1: Chapter title', 'Chapter title'),
    ('Chapter 1 - Chapter title', 'Chapter title'),
    ('Chapter 1- Chapter title', 'Chapter title'),
])
def test_remove_chapter_prefix(title, correct):
    assert remove_chapter_prefix(title) == correct


if __name__ == '__main__':
    pytest.main()
