import os
import time

import pytest
from elasticsearch import Elasticsearch

ELASTIC_INDEX = 'manga_test'
os.environ['ES_INDEX'] = ELASTIC_INDEX

from src.elasticsearch.methods import ElasticMethods
from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import (create_db, Postgresql, teardown_db,
                                     start_db, get_conn)
from src.utils.dbutils import DbUtil
from src.utils.utilities import inject_service_values
from src.setup_logging import setup


@pytest.fixture(scope='session')
def es():
    client = Elasticsearch([{
        "host": os.getenv('ELASTIC_TEST_HOST', 'localhost'),
        "port": os.getenv('ELASTIC_TEST_PORT', 9200)
    }])
    yield client
    print(f'Dropping index {ELASTIC_INDEX}')
    client.indices.delete(index=ELASTIC_INDEX)
    client.close()


@pytest.fixture
def esm(es: Elasticsearch):
    return ElasticMethods(es)


@pytest.fixture
def dbutil(esm: ElasticMethods, conn):
    return DbUtil(conn, esm)


@pytest.fixture(scope='class')
def class_dbutil(es: Elasticsearch, conn):
    return DbUtil(conn, ElasticMethods(es))


@pytest.fixture(scope='session')
def database(request: pytest.FixtureRequest, es):
    print('setting up')
    start_db()
    conn = create_db(None if not Postgresql else Postgresql.cache)
    dbutil = DbUtil(conn, None)
    inject_service_values(dbutil)

    DummyScraper(conn, dbutil).add_service()
    DummyScraper2(conn, dbutil).add_service()

    with conn.cursor() as cur:
        from src.elasticsearch.reindex import reindex
        reindex(es, cur)

    from src.scrapers import SCRAPERS, SCRAPERS_ID
    SCRAPERS[DummyScraper.URL] = DummyScraper
    SCRAPERS[DummyScraper2.URL] = DummyScraper2

    SCRAPERS_ID[DummyScraper.ID] = DummyScraper
    SCRAPERS_ID[DummyScraper2.ID] = DummyScraper2

    conn.commit()
    conn.close()

    def fin():
        print('\nDeleting test db')
        teardown_db()

    request.addfinalizer(fin)


@pytest.fixture(scope='class')
def conn(database):
    return get_conn()


@pytest.fixture(scope='session', autouse=True)
def setup_tests():
    # No need to sleep in tests
    time.sleep = lambda *_: None

    setup()
