from typing import LiteralString

from psycopg import Cursor
from psycopg.rows import DictRow

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from src.elasticsearch.configuration import INDEX_BODY, INDEX_NAME
from src.elasticsearch.methods import ElasticMethods


def reindex(es: Elasticsearch, cur: Cursor[DictRow], batch_size: int = 5000) -> None:
    print(f'reindexing index {INDEX_NAME}')
    if es.indices.exists(index=INDEX_NAME):
        es.indices.delete(index=INDEX_NAME)
    es.indices.create(index=INDEX_NAME, body=INDEX_BODY)

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
    from src.scheduler import UpdateScheduler

    setup_logging.setup()
    scheduler = UpdateScheduler()
    with scheduler.conn() as conn, conn.cursor() as cur:
        es = get_client()
        esm = ElasticMethods(es)

        reindex(es, cur)

    es.close()
    scheduler.pool.close()
