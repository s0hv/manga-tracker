import json
import os
import unittest

from src.utils.utilities import (universal_chapter_regex, match_title,
                                 parse_chapter_number, round_seconds)


class TestUtilities(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        with open(os.path.join(os.path.dirname(__file__), 'utilities.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

    def test_regex(self):
        for case in self.test_cases:
            if not case['string']:
                continue

            match = universal_chapter_regex.match(case['string'])
            self.assertTrue(match is not None, f"Failed to match {case['string']}")

            self.assertTrue(match.groupdict() == case['correct'], f"Failed to parse {case['string']} correctly")

    def test_match_title(self):
        for case in self.test_cases:
            if not case['string']:
                continue

            match = match_title(case['string'])
            self.assertTrue(match is not None,
                            f"Failed to match {case['string']}")

            correct = case['correct'].copy()
            correct['chapter'] = correct['chapter'] or correct.pop('chapter_number2')
            correct['decimal'] = correct['decimal'] or correct.pop('chapter_decimal2')

            self.assertDictEqual(match, correct,
                                 f"Failed to parse {case['string']} correctly")

    def test_parse_chapter_number(self):
        data = [
            ('1', ('1', None)),
            ('abc', (None, None)),
            ('1.5', ('1', '5')),
        ]

        for chapter_number, correct in data:
            self.assertTupleEqual(parse_chapter_number(chapter_number), correct)

    def test_round_seconds(self):
        data = [
            ((0, 1), 0),
            ((50, 100), 0),
            ((51, 100), 100),
            ((150, 100), 100),
            ((151, 100), 200),
        ]

        for args, correct in data:
            self.assertEqual(round_seconds(*args), correct,
                             msg=f'round_seconds({", ".join(map(str, args))}) did not equal {correct}')


if __name__ == '__main__':
    unittest.main()
