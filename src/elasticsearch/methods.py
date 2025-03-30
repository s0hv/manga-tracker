import logging
from collections.abc import Collection, Iterable
from typing import TypedDict

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from src.elasticsearch.configuration import INDEX_NAME

logger = logging.getLogger('debug')


class TitleUpdate(TypedDict):
    _id: int
    manga_id: int
    title: str
    aliases: Collection[str]


class ElasticMethods:
    def __init__(self, es: Elasticsearch):
        self._es = es

    @property
    def es(self) -> Elasticsearch:
        return self._es

    def update_manga_title(self, manga_id: int, title: str) -> None:
        self.es.update(index=INDEX_NAME, id=str(manga_id), body={'title': title})

    def bulk_upsert(self, documents: Iterable, operation: str = 'update') -> None:
        logger.debug(
            'Bulk upsert returned %s',
            bulk(
                self.es,
                (
                    {
                        '_index':   INDEX_NAME,
                        '_op_type': operation,
                        '_id':      doc.pop('_id'),
                        # bulk update needs to be wrapped inside doc for some reason
                        '_source':  doc if operation != 'update' else {'doc': doc},
                    }
                    for doc in documents
                ),
                index=INDEX_NAME,
            ),
        )

    @staticmethod
    def format_aliases(rows: Iterable[dict]):
        empty: list = []
        for row in rows:
            row['aliases'] = [{'title': alias} for alias in row['aliases'] or empty]
            yield row
