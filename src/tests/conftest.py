import pytest

from src.tests.scrapers.testing_scraper import TestingScraper
from src.tests.testing_utils import create_db, Postgresql, teardown_db, start_db
from src.utils.dbutils import DbUtil


@pytest.fixture(scope='session', autouse=True)
def setup_tests(request):
    print('setting up')
    start_db()
    conn = create_db(None if not Postgresql else Postgresql.cache)
    TestingScraper(conn, DbUtil(conn)).add_service()
    conn.close()

    def fin():
        print('\nDeleting test db')
        teardown_db()

    request.addfinalizer(fin)
