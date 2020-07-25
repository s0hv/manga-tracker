import logging
import os

import psycopg2
from psycopg2.extras import DictCursor

import setup_logging
from src.scrapers import SCRAPERS
from src.utils.dbutils import DbUtil

setup_logging.setup()
logger = logging.getLogger('debug')

config = {
    'db_host': os.environ['DB_HOST'],
    'db': os.environ['DB_NAME'],
    'db_user': os.environ['DB_USER'],
    'db_pass': os.environ['DB_PASSWORD'],
    'db_port': os.environ['DB_PORT']
}


conn = psycopg2.connect(host=config['db_host'],
                        port=config['db_port'],
                        user=config['db_user'],
                        password=config['db_pass'],
                        dbname=config['db'],
                        cursor_factory=DictCursor)
with conn:
    with conn.cursor() as cur:
        sql = 'SELECT url FROM services'
        cur.execute(sql)
        for row in cur:
            SCRAPERS.pop(row[0], None)

    for Scraper in SCRAPERS.values():
        scraper = Scraper(conn, DbUtil(conn))  # type: ignore[abstract]
        scraper.add_service()
