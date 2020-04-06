class BaseWebException(Exception):
    pass


class ConversionError(BaseWebException):
    pass


class NotFound(BaseWebException):
    pass
