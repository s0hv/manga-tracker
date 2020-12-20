from typing import Optional, Tuple


class ScheduledRun:
    def __init__(self, manga_id: int, service_id: int, created_by: Optional[int] = None):
        self.manga_id = manga_id
        self.service_id = service_id
        self.created_by = created_by

    def to_tuple(self) -> Tuple[int, int, int]:
        """
        Returns a tuple of manga id, service id and user id
        """
        return self.manga_id, self.service_id, self.created_by
