class BaseFeedException(Exception):
    pass


class FeedHttpError(BaseFeedException):
    pass


class InvalidFeedError(BaseFeedException):
    def __init__(self, msg, original):
        super().__init__(f'{msg}\n{original.getException()}')
        self.original = original
