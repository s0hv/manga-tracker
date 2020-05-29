class BaseFeedException(Exception):
    pass


class FeedHttpError(BaseFeedException):
    pass


class InvalidFeedError(BaseFeedException):
    def __init__(self, msg, original: Exception):
        exc = original.getException() if hasattr(original, 'getException') else original
        super().__init__(f'{msg}\n{exc}')
        self.original = original
