import pytest

from src.tests.scrapers.testing_scraper import DummyScraper
from src.tests.testing_utils import create_db, Postgresql, teardown_db, start_db, BaseTestClasses
from src.utils.dbutils import DbUtil


@pytest.fixture(scope='session', autouse=True)
def setup_tests(request):
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
    DummyScraper(conn, dbutil).add_service()
    conn.close()

    def fin():
        print('\nDeleting test db')
        teardown_db()

    request.addfinalizer(fin)
