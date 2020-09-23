import json
import os
import unittest
from base64 import b64decode

import responses

from src.scrapers.mangaplus.mangaplus import ResponseWrapper, MangaPlus
from src.tests.testing_utils import BaseTestClasses, spy_on


def find_dict_inequality(d1, d2):
    if d1 == d2:
        return True

    for k in d1:
        if d1[k] != d2[k]:
            print(d1[k])
            print(d2[k])
            print(f"{k} doesn't match")
            return False

    return True


class TestMangaPlusParser(BaseTestClasses.DatabaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dbutil = spy_on(self.dbutil)
        self.mangaplus = MangaPlus(self._conn, self.dbutil)

        file = os.path.dirname(__file__)
        with open(os.path.join(file, 'mangaplus.json'), encoding='utf-8') as f:
            self.test_cases = json.load(f)

        with open(os.path.join(file, 'mangaplus_jojo.dat'), 'rb') as f:
            self.request_data_jojo = f.read()

    def test_series(self):
        for case in self.test_cases:
            correct = case['correct']
            resp = ResponseWrapper(b64decode(case['data']))
            series_dict = resp.title_detail_view.to_dict()
            self.assertTrue(find_dict_inequality(series_dict, correct),
                            "Series objects don't exactly match each other")

    @responses.activate
    def test_scrape_correctly_with_valid_input(self):
        title_id = '100072'
        manga_id = 4
        responses.add(responses.GET, MangaPlus.API.format(title_id),
                      body=self.request_data_jojo)
        self.assertTrue(self.mangaplus.scrape_series(title_id, MangaPlus.ID, manga_id))
        self.assertEqual(len(responses.calls), 1)


if __name__ == '__main__':
    unittest.main()
