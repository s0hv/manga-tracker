import json
import os
import unittest
from src.scrapers.mangaplus import Series


class TestMangaPlusParser(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        with open(os.path.join('unit-tests', 'test-data', 'mangaplus.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

    def check_series(self, ignore_when_none=False):
        for case in self.test_cases:
            data = case['data']
            correct = case['correct']
            series = Series(data)
            series.decode()
            series_dict = series.__dict__()
            self.assertTrue(Series.compare_obj(series_dict, correct, ignore_when_none),
                            "Series objects don't exactly match each other")

    def test_series_exact(self):
        self.check_series()

    def test_series(self):
        self.check_series(True)


if __name__ == '__main__':
    unittest.main()
