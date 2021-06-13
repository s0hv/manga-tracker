from typing import Optional

from pydantic import BaseModel


class GroupPartial(BaseModel):
    name: str
    mangadex_id: Optional[str]


class Group(GroupPartial):
    group_id: int
