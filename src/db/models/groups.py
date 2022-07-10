from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, validator


class GroupPartial(BaseModel):
    name: str
    mangadex_id: Optional[str]

    @validator('mangadex_id', pre=True)
    def uuid2str(cls, v: Any):
        if isinstance(v, UUID):
            return str(v)
        return v


class Group(GroupPartial):
    group_id: int
