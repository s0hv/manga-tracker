from datetime import timedelta

from src.scrapers.foolslide import FoolSlide


class KireiCake(FoolSlide):
    ID = 7
    NAME = 'Kirei Cake'
    URL = 'https://kireicake.com'
    FEED_URL = 'https://reader.kireicake.com/reader'
    CHAPTER_URL_FORMAT = 'https://reader.kireicake.com/read/{}'
    MANGA_URL_FORMAT = 'https://reader.kireicake.com/series/{}'
    UPDATE_INTERVAL = timedelta(hours=1)

    @staticmethod
    def min_update_interval() -> timedelta:
        return KireiCake.UPDATE_INTERVAL
