from typing import Union
from xml.sax import SAXException


class BaseFeedException(Exception):
    pass


class FeedHttpError(BaseFeedException):
    pass


class InvalidFeedError(BaseFeedException):
    def __init__(self, msg, original: Union[Exception, SAXException]):
        exc = original.getException() if hasattr(original, 'getException') else original
        super().__init__(f'{msg}\n{exc}')
        self.original = original
