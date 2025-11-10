import contextlib
import os
import time

import pytest
from elasticsearch import Elasticsearch, NotFoundError
from psycopg import Connection
from psycopg.rows import DictRow

from src.setup_logging import setup
from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import Postgresql, create_db, get_conn, start_db, teardown_db
from src.utils.dbutils import DbUtil
from src.utils.utilities import inject_service_values

ELASTIC_INDEX = 'manga_test'
os.environ['ES_INDEX'] = ELASTIC_INDEX
# The environment variable must be set before importing the module
from src.elasticsearch.methods import ElasticMethods  # noqa: E402


@pytest.fixture(scope='session')
def es():
    client = Elasticsearch([{
        'host': os.getenv('ELASTIC_TEST_HOST', 'localhost'),
        'port': os.getenv('ELASTIC_TEST_PORT', '9200')
    }])
    yield client
    print(f'Dropping index {ELASTIC_INDEX}')
    with contextlib.suppress(NotFoundError):
        client.indices.delete(index=ELASTIC_INDEX)
    client.close()


@pytest.fixture
def esm(es: Elasticsearch) -> ElasticMethods:
    return ElasticMethods(es)


@pytest.fixture
def dbutil(esm: ElasticMethods, conn: Connection[DictRow]) -> DbUtil:
    return DbUtil(conn, esm)


@pytest.fixture(scope='class')
def class_dbutil(es: Elasticsearch, conn: Connection[DictRow]) -> DbUtil:
    return DbUtil(conn, ElasticMethods(es))


@pytest.fixture(scope='session')
def database(request: pytest.FixtureRequest, es: Elasticsearch) -> None:
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

    def fin() -> None:
        print('\nDeleting test db')
        teardown_db()

    request.addfinalizer(fin)  # noqa: PT021


@pytest.fixture(scope='class')
def conn(database: None) -> Connection[DictRow]:  # noqa: ARG001
    return get_conn()


@pytest.fixture(scope='session', autouse=True)
def setup_tests() -> None:
    # No need to sleep in tests
    time.sleep = lambda *_: None

    setup()
