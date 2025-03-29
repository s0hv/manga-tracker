from uuid import UUID

from pydantic import BaseModel, field_validator


class GroupPartial(BaseModel):
    name: str
    mangadex_id: str | None = None

    @field_validator('mangadex_id', mode='before')
    @classmethod
    def uuid2str(cls, v: str | UUID | None) -> str | None:
        if isinstance(v, UUID):
            return str(v)
        return v


class Group(GroupPartial):
    group_id: int
