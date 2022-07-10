from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, validator


class AuthorPartial(BaseModel):
    name: str
    mangadex_id: Optional[str]

    @validator('mangadex_id', pre=True)
    def uuid2str(cls, v: Any):
        if isinstance(v, UUID):
            return str(v)
        return v


class Author(AuthorPartial):
    author_id: int


# As a separate base class to spot type errors when passing MangaAuthor as MangaArtist
class MangaAuthorBase(BaseModel):
    author_id: int
    manga_id: int


class MangaAuthor(MangaAuthorBase):
    pass


class MangaArtist(MangaAuthorBase):
    pass
