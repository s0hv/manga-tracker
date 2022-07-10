from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from psycopg import Cursor

from src.elasticsearch.configuration import INDEX_NAME, INDEX_BODY
from src.elasticsearch.methods import ElasticMethods


def reindex(es: Elasticsearch, cur: Cursor, batch_size=5000):
    print(f'reindexing index {INDEX_NAME}')
    if es.indices.exists(INDEX_NAME):
        es.indices.delete(INDEX_NAME)
    es.indices.create(INDEX_NAME, body=INDEX_BODY)

    sql = '''
SELECT
    m.manga_id as _id,
    m.manga_id,
    m.title,
    m.views,
    (SELECT array_remove(array_agg(ma.title), NULL) FROM manga_alias ma WHERE ma.manga_id=m.manga_id) as aliases,
    array_agg(json_build_object('service_id', s.service_id, 'service_name', s.service_name)) as services
FROM manga m
INNER JOIN manga_service ms ON m.manga_id = ms.manga_id
INNER JOIN services s ON s.service_id = ms.service_id
GROUP BY m.manga_id, ms.manga_id
    '''

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
    from src.elasticsearch.configuration import get_client
    from src.scheduler import UpdateScheduler
    import setup_logging

    setup_logging.setup()
    scheduler = UpdateScheduler()
    with scheduler.conn() as conn:
        with conn.cursor() as cur:
            es = get_client()
            esm = ElasticMethods(es)

            reindex(es, cur)

    es.close()
    scheduler.pool.close()
