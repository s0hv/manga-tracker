class BaseDbError(Exception):
    pass


class RowNotFound(BaseDbError):
    pass
