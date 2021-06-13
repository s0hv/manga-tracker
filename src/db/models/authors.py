from typing import Optional

from pydantic import BaseModel


class AuthorPartial(BaseModel):
    name: str
    mangadex_id: Optional[str]


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
