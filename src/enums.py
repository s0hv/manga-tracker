import enum


class Status(enum.IntEnum):
    ONGOING = 0
    COMPLETED = 1
    DROPPED = 2
    HIATUS = 3

    @staticmethod
    def from_mangadex(status: int) -> int:
        # Mangadex status ids go from 1 to 4
        return status - 1
