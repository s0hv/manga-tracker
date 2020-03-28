import json
import os
import unittest

from src.utils.utilities import universal_chapter_regex


class TestUtilities(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        with open(os.path.join('unit-tests', 'test-data', 'utilities.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

    def test_regex(self):
        for case in self.test_cases:
            if not case['string']:
                continue

            match = universal_chapter_regex.match(case['string'])
            self.assertTrue(match is not None, f"Failed to match {case['string']}")

            self.assertTrue(match.groupdict() == case['correct'], f"Failed to parse {case['string']} correctly")


if __name__ == '__main__':
    unittest.main()
