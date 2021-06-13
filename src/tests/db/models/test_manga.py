import unittest
from unittest.mock import patch, MagicMock

from src import scrapers
from src.db.models.manga import MangaInfo, MangaService


class MyTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.mock_scraper = MagicMock()

        self.mock_scrapers = patch.object(
            scrapers, 'SCRAPERS_ID', {1: self.mock_scraper}
        )

    def test_can_instantiate_manga_info(self):
        m = MangaInfo(manga_id=1)
        self.assertEqual(m.manga_id, 1)

    def test_manga_service_scraper(self):
        with self.mock_scrapers:
            m = MangaService(service_id=1, disabled=False, manga_id=1, title='', title_id='')
            self.assertEqual(m.Scraper, self.mock_scraper)

    def test_manga_service_scrape_series(self):
        with self.mock_scrapers:
            m = MangaService(service_id=1, disabled=False, title_id='', manga_id=1, title='', feed_url='test')
            m.scrape_series(None, None)

            self.mock_scraper().scrape_series.assert_called()


if __name__ == '__main__':
    unittest.main()
