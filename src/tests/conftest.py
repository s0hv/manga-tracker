import time

import pytest

from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import (create_db, Postgresql, teardown_db,
                                     start_db, BaseTestClasses)
from src.utils.dbutils import DbUtil
from src.utils.utilities import inject_service_values


@pytest.fixture(scope='session', autouse=True)
def setup_tests(request):
    # No need to sleep in tests
    time.sleep = lambda *_: None

    requires_database = False

    # Initiate database only if it is required for the tests we are running
    for item in request.node.items:
        if issubclass(item.cls, BaseTestClasses.DatabaseTestCase):
            requires_database = True
            break

    if not requires_database:
        return

    print('setting up')
    start_db()
    conn = create_db(None if not Postgresql else Postgresql.cache)
    dbutil = DbUtil(conn)
    inject_service_values(dbutil)

    DummyScraper(conn, dbutil).add_service()
    DummyScraper2(conn, dbutil).add_service()

    from src.scrapers import SCRAPERS, SCRAPERS_ID
    SCRAPERS[DummyScraper.URL] = DummyScraper
    SCRAPERS[DummyScraper2.URL] = DummyScraper2

    SCRAPERS_ID[DummyScraper.ID] = DummyScraper
    SCRAPERS_ID[DummyScraper2.ID] = DummyScraper2

    conn.close()

    def fin():
        print('\nDeleting test db')
        teardown_db()

    request.addfinalizer(fin)
