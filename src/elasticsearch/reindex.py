import os
from collections.abc import Generator
from contextlib import contextmanager
from typing import LiteralString

import psycopg
from elasticsearch.helpers import bulk
from psycopg import Connection, Cursor
from psycopg.rows import DictRow
from psycopg_pool import ConnectionPool

from elasticsearch import Elasticsearch
from src.elasticsearch.configuration import INDEX_MAPPINGS, INDEX_NAME, INDEX_SETTINGS
from src.elasticsearch.methods import ElasticMethods


def reindex(es: Elasticsearch, cur: Cursor[DictRow], batch_size: int = 5000) -> None:
    print(f'reindexing index {INDEX_NAME}')
    if es.indices.exists(index=INDEX_NAME):
        es.indices.delete(index=INDEX_NAME)
    es.indices.create(index=INDEX_NAME, mappings=INDEX_MAPPINGS, settings=INDEX_SETTINGS)

    sql: LiteralString = """
SELECT
    m.manga_id AS _id,
    m.manga_id,
    m.title,
    m.views,
    (SELECT ARRAY_REMOVE(ARRAY_AGG(ma.title), NULL) FROM manga_alias ma WHERE ma.manga_id=m.manga_id) AS aliases,
    ARRAY_AGG(JSON_BUILD_OBJECT('service_id', s.service_id, 'service_name', s.service_name)) AS services
FROM manga m
INNER JOIN manga_service ms ON m.manga_id = ms.manga_id
INNER JOIN services s ON s.service_id = ms.service_id
GROUP BY m.manga_id, ms.manga_id
"""

    cur.execute(sql)
    data = cur.fetchmany(batch_size)
    total = 0
    print(f'{total}')
    while len(data) > 0:
        bulk(es, ElasticMethods.format_aliases(data), index=INDEX_NAME)

        total += len(data)
        print(f'{total}')
        data = cur.fetchmany(batch_size)


if __name__ == '__main__':
    from src import setup_logging
    from src.elasticsearch.configuration import get_client

    config = {
        'host':        os.environ['DB_HOST'],
        'dbname':      os.environ['DB_NAME'],
        'user':        os.environ['DB_USER'],
        'password':    os.environ['DB_PASSWORD'],
        'port':        os.environ['DB_PORT'],
        'row_factory': psycopg.rows.dict_row,
    }

    pool = ConnectionPool[Connection[DictRow]](
        connection_class=Connection[DictRow],
        min_size=1,
        max_size=1,
        kwargs=config,
        open=True,
    )

    @contextmanager
    def connection() -> Generator[Connection[DictRow]]:
        conn_: Connection[DictRow] = pool.getconn()
        try:
            yield conn_
        except Exception:
            conn_.rollback()
            raise
        else:
            conn_.commit()
        finally:
            pool.putconn(conn_)

    setup_logging.setup()
    with connection() as conn, conn.cursor() as cur:
        es = get_client()
        esm = ElasticMethods(es)

        reindex(es, cur)

    es.close()
    pool.close()
