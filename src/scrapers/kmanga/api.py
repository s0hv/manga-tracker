import json
import logging
import math
from datetime import datetime
from datetime import timezone as tz
from hashlib import sha256, sha512
from typing import Annotated, Any, Literal, TypedDict
from zoneinfo import ZoneInfo

import requests
from lxml import etree
from pydantic import BaseModel, ValidateAs

from src.utils.utilities import dict_to_model

logger = logging.getLogger('debug')


class BirthdayCookie(TypedDict):
    value: str
    expires: int


hour_in_seconds = 3600
year_in_seconds = 31536000
birthday_cookie: BirthdayCookie = {'value': '1992-06', 'expires': 1793814475}
kmanga_timezone = ZoneInfo('Etc/GMT+5')
kodansha_url = 'https://kmanga.kodansha.com'


KMangaResultStatus = Literal['success']


def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=tz.utc)


def _update_cookie_expires() -> None:
    now = datetime.now(tz.utc).timestamp()
    birthday_expires = birthday_cookie['expires']

    if birthday_expires < now - hour_in_seconds:
        # We increase the cookie expiration time so it's now + one year.
        # We use a statically calculated value so the hash stays the same between runs.
        years_to_add = math.ceil((now - birthday_expires) / year_in_seconds)
        birthday_cookie['expires'] = birthday_expires + years_to_add * year_in_seconds


# Run the function immediately to set the initial cookie expiration time.
# This ensures that the same birthday cookie is used for all requests.
_update_cookie_expires()


class KMangaTitleUpdate(BaseModel):
    title_id: int
    title_name: str
    # This will not be the latest chapter ID if the latest chapter is paid
    latest_free_episode_id: int | None = None


class LatestUpdatesResponse(BaseModel):
    status: KMangaResultStatus | str
    error_message: str | None = None
    title_list: list[KMangaTitleUpdate]


class KMangaEpisode(BaseModel):
    episode_id: int
    # Index of the chapter. This is not the chapter number.
    index: int
    comic_volume: int | None = None
    episode_name: str
    # When the chapter was released
    start_time: Annotated[datetime, ValidateAs(str, parse_date)]
    title_id: int


class TitleChaptersList(BaseModel):
    status: KMangaResultStatus | str
    error_message: str | None = None
    episode_list: list[KMangaEpisode]


def get_birthday_cookie_hash() -> str:
    return hash_param(birthday_cookie['value'], birthday_cookie['expires'])


def hash_param(key: str, value: Any) -> str:  # noqa: ANN401
    return f'{sha256(key.encode()).hexdigest()}_{sha512(str(value).encode()).hexdigest()}'


def hash_params(params: dict | None) -> str:
    params_hashed = [hash_param(k, v) for k, v in sorted(params.items())] if params else []

    # Array.toString() uses ',' as the separator in JavaScript
    param_hash = sha256(','.join(params_hashed).encode()).hexdigest()
    birthday_hash = get_birthday_cookie_hash()

    return sha512(f'{param_hash}{birthday_hash}'.encode()).hexdigest()


def get_headers(params: dict | None) -> dict[str, str]:
    headers = {
        'x-kmanga-hash': hash_params(params),
        'x-kmanga-is-crawler': 'false',
        'x-kmanga-platform': '3',
        'accept': '*/*',
        'referer': f'{kodansha_url}/',
    }

    return headers


class KMangaAPI:
    def __init__(self, url: str = 'https://api.kmanga.kodansha.com'):
        self.base_url = url

    def _validate_response(self, r: requests.Response, path: str, params: dict | None = None):
        if not r.ok:
            logger.error(
                f'Failed to {r.request.method} {self.base_url}{path}\n'
                f'HTTP status: {r.status_code}\n'
                f'response body: {r.text}\n'
                f'request params: {params}\n'
                f'hash: {r.request.headers.get("x-kmanga-hash")}'
            )
            raise ValueError(f'Failed to fetch {self.base_url}{path}')

    def get_latest_updates(self, base_date: datetime) -> LatestUpdatesResponse:
        params = {'base_date': base_date.astimezone(kmanga_timezone).strftime('%Y-%m-%d')}
        path = '/web/top/updated/title'

        logger.info('Fetching KManga latest updates with date %s', params['base_date'])

        r = requests.request(
            'GET', f'{self.base_url}{path}', headers=get_headers(params), params=params
        )

        self._validate_response(r, path, params)

        return dict_to_model(r.json(), LatestUpdatesResponse)

    def get_title_chapters(self, title_id: str) -> list[TitleChaptersList] | None:
        r = requests.get(f'https://kmanga.kodansha.com/title/{title_id}')

        if not r.ok:
            raise ValueError(f'Failed to fetch {r.url}')

        root = etree.HTML(r.text)
        nuxt_data_elems = root.cssselect('script#__NUXT_DATA__')

        if not nuxt_data_elems:
            logger.warning(f'Failed to find __NUXT_DATA__ script for KManga title {title_id}')
            return None

        nuxt_data_elem = nuxt_data_elems[0]

        if not nuxt_data_elem.text:
            logger.warning(f'__NUXT_DATA__ script for KManga title {title_id} is empty')
            return None

        nuxt_data: list = json.loads(nuxt_data_elem.text)
        episode_ids_ref_index = next(
            filter(lambda x: isinstance(x, dict) and 'episode_id_list' in x, nuxt_data)
        )['episode_id_list']
        episode_id_refs = nuxt_data[episode_ids_ref_index]
        episode_ids = [str(nuxt_data[episodeIdRef]) for episodeIdRef in episode_id_refs]

        chunk_size = 100

        retval = []

        for i in range(0, len(episode_ids), chunk_size):
            episode_ids_chunk = episode_ids[i:i + chunk_size]
            params = {'episode_id_list': ','.join(episode_ids_chunk)}
            headers = get_headers(params)
            headers['Origin'] = kodansha_url
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
            headers['Accept'] = 'application/json'
            path = 'episode/list'

            r = requests.request('POST', f'{self.base_url}/{path}', headers=headers, data=params)

            self._validate_response(r, path, params)

            model_json = r.json()
            retval.append(dict_to_model(model_json, TitleChaptersList))

        return retval
