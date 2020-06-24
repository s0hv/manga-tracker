import json
import os
import unittest
from base64 import b64decode

from src.scrapers.mangaplus.mangaplus import ResponseWrapper


def find_dict_inequality(d1, d2):
    if d1 == d2:
        return True

    for k in d1:
        if d1[k] != d2[k]:
            print(d1[k], d2[k])
            print(f"{k} doesn't match")
            return False

    return True


class TestMangaPlusParser(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        with open(os.path.join(os.path.dirname(__file__), 'mangaplus.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

    def test_series(self):
        for case in self.test_cases:
            correct = case['correct']
            resp = ResponseWrapper(b64decode(case['data']))
            series_dict = resp.title_detail_view.to_dict()
            self.assertTrue(find_dict_inequality(series_dict, correct),
                            "Series objects don't exactly match each other")


if __name__ == '__main__':
    unittest.main()
