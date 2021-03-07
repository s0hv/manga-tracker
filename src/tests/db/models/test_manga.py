import unittest
from unittest.mock import patch, MagicMock

from src.db.models.manga import Manga, MangaInfo, MangaService
from src import scrapers


class MyTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.mock_scraper = MagicMock()

        self.mock_scrapers = patch.object(
            scrapers, 'SCRAPERS_ID', {1: self.mock_scraper}
        )

    def test_manga_row_to_kwargs(self):
        m = Manga(1, '')
        self.assertDictEqual(m.row_to_kwargs({}), {})

    def test_can_instantiate_manga_info(self):
        m = MangaInfo(
            1, '', 1, '', '', '', '', '', '', '', '', '', '', '', '', ''
        )
        self.assertEqual(m.manga_id, 1)

    def test_manga_service_row_to_kwargs(self):
        m = MangaService(1, False, '', manga_id=1, title='')
        self.assertDictEqual(m.row_to_kwargs({}), {})

    def test_manga_service_scraper(self):
        with self.mock_scrapers:
            m = MangaService(1, False, '', manga_id=1, title='')
            self.assertEqual(m.Scraper, self.mock_scraper)

    def test_manga_service_scrape_series(self):
        with self.mock_scrapers:
            m = MangaService(1, False, '', manga_id=1, title='')
            m.scrape_series(None, None)

            self.mock_scraper().scrape_series.assert_called()


if __name__ == '__main__':
    unittest.main()
