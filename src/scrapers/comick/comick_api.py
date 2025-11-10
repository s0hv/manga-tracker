import logging
import ssl
from collections.abc import Iterable
from datetime import datetime
from enum import Enum
from typing import Any, Literal, override

import requests
from pydantic import BaseModel, ValidationError
from ratelimit import rate_limited, sleep_and_retry
from requests.adapters import HTTPAdapter

from src.enums import Status as MangaStatus

logger = logging.getLogger('debug')

api_rate_limiter = rate_limited(5, 2)

type SortOrder = Literal['new', 'hot']


class Status(Enum):
    ongoing = 1
    completed = 2
    cancelled = 3
    hiatus = 4

    def to_int(self) -> int:
        d: dict[Status, int] = {
            self.ongoing:   MangaStatus.ONGOING.value,
            self.completed: MangaStatus.COMPLETED.value,
            self.cancelled: MangaStatus.DROPPED.value,
            self.hiatus:    MangaStatus.HIATUS.value,
        }

        return d[self]


class MangaResult(BaseModel):
    id: int
    hid: str
    title: str
    slug: str
    status: Status


class ChapterResult(BaseModel):
    id: int
    chap: str | None
    vol: str | None
    # Only available when fetching chapters for a specific manga
    title: str | None = None
    last_at: datetime | None = None
    created_at: datetime
    hid: str
    group_name: list[str] | None
    updated_at: datetime
    publish_at: datetime | None


class ChapterResultWithManga(ChapterResult):
    md_comics: MangaResult


def handle_response(r: requests.Response) -> list:
    if not r.ok:
        raise ValueError(f'Failed to fetch {r.url}', r)

    json = r.json()

    if not isinstance(json, list):
        if 'chapters' not in json:
            raise ValueError(f'Expected a list response or list not found with key "chapters", got {type(json)}', r)

        return json['chapters']

    return json


# noinspection PyPep8Naming
def request_to_model[TModel: BaseModel](
    r: requests.Response, Model: type[TModel], *, continue_on_error: bool = False
) -> Iterable[TModel]:
    for result in handle_response(r):
        try:
            yield Model(**result)
        except ValidationError:
            logger.warning(
                f'Failed to parse result for model {Model.__name__} {result}', exc_info=True
            )
        except Exception as e:
            logger.exception(f'Unexpected error when parsing model {Model.__name__} {result}')
            if continue_on_error:
                continue

            raise e


class CustomHTTPAdapter(HTTPAdapter):

    @override
    def init_poolmanager(self, *args: Any, **kwargs: Any):
        # Comick API requires TLSv1.3
        ssl_context = ssl.create_default_context()
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_3

        super().init_poolmanager(*args, **kwargs, ssl_context=ssl_context)  # type: ignore[no-untyped-call]


class ComickAPI:
    def __init__(self, url: str = 'https://api.comick.fun'):
        self.base_url = url

    @staticmethod
    def get_session() -> requests.Session:
        session = requests.Session()
        session.mount('https://', CustomHTTPAdapter())
        return session

    @staticmethod
    def get_headers() -> dict[str, str]:
        return {
            'Accept':     'application/json',
            # Required user agent for Comick API
            'User-Agent': 'Android',
        }

    @sleep_and_retry
    @api_rate_limiter
    def get_chapters(
        self,
        *,
        languages: list[str],
        tachiyomi: bool = True,
        sort_order: SortOrder = 'new',
    ) -> Iterable[ChapterResult]:
        params = [
            f'order={sort_order}',
            f'tachiyomi={str(tachiyomi).lower()}'
        ]

        if languages:
            params.append(f'lang={",".join(languages)}')

        session = self.get_session()
        r = session.get(
            f'{self.base_url}/chapter/?{"&".join(params)}',
            headers=self.get_headers(),
        )

        return request_to_model(r, ChapterResultWithManga)

    @sleep_and_retry
    @api_rate_limiter
    def get_manga_chapters(
        self,
        manga_id: str,
        *,
        languages: list[str],
        limit: int = 100,
        page: int = 1,
    ) -> Iterable[ChapterResult]:
        params = [
            f'limit={limit}',
            f'page={page}',
        ]

        if languages:
            params.append(f'lang={",".join(languages)}')

        session = self.get_session()
        r = session.get(
            f'{self.base_url}/comic/{manga_id}/chapters?{"&".join(params)}',
            headers=self.get_headers(),
        )

        return request_to_model(r, ChapterResult)
