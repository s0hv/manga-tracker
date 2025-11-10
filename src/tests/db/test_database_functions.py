import unittest
from collections.abc import Collection
from typing import override

import psycopg.errors
import pytest
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel

from src.db.models.authors import AuthorPartial, MangaArtist, MangaAuthor
from src.db.models.chapter import Chapter
from src.db.models.manga import MangaInfo, MangaService, MangaServiceWithId
from src.scrapers import MangaPlus
from src.scrapers.base_scraper import BaseScraper
from src.tests.scrapers.testing_scraper import DummyScraper, DummyScraper2
from src.tests.testing_utils import BaseTestClasses, assert_count_equals
from src.utils.dbutils import DbUtil
from src.utils.utilities import utcnow


class MergeResult(BaseModel):
    alias_count: int
    chapter_count: int


class TestMergeManga(BaseTestClasses.DatabaseTestCase):
    @pytest.fixture(autouse=True, scope='class')
    def _set_up_merge_manga(self, class_dbutil: DbUtil, conn: Connection[DictRow]) -> None:
        MangaPlus(conn, class_dbutil).add_service()

    def merge_manga(self, base: int, to_merge: int, service_id: int | None = None) -> MergeResult:
        return MergeResult(
            **self.dbutil.execute('SELECT alias_count, chapter_count FROM merge_manga(%s, %s, %s)', (base, to_merge, service_id))[0]
        )

    def get_aliases(self, manga_id: int) -> list[str]:
        rows = self.dbutil.execute('SELECT title FROM manga_alias WHERE manga_id=%s', (manga_id,))
        return [row['title'] for row in rows]

    @override
    def create_manga_service(self, scraper: type[BaseScraper] = DummyScraper) -> MangaServiceWithId:
        ms = self.get_manga_service(scraper)
        ms.last_check = self.utcnow()
        self.dbutil.add_manga_service(ms, add_manga=True)
        return MangaServiceWithId(**ms.model_dump())

    def create_manga_info(self, ms: MangaService, status: int = 1) -> MangaInfo:
        if ms.manga_id is None:
            raise ValueError('Manga id is None')

        mi = MangaInfo(
            manga_id=ms.manga_id,
            cover=self.get_str_id(),
            status=status,
            bw=self.get_str_id(), mu=self.get_str_id(),
            mal=self.get_str_id(), amz=self.get_str_id(),
            ebj=self.get_str_id(), engtl=self.get_str_id(),
            raw=self.get_str_id(), nu=self.get_str_id(),
            kt=self.get_str_id(), ap=self.get_str_id(),
            al=self.get_str_id(), last_updated=utcnow()
        )

        sql = (
            'INSERT INTO manga_info (manga_id, cover, status, bw, mu, mal, amz, ebj, engtl, raw, nu, kt, ap, al, last_updated) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'
        )
        self.dbutil.execute(sql,
                            (mi.manga_id, mi.cover, mi.status,
                             mi.bw, mi.mu, mi.mal, mi.amz, mi.ebj, mi.engtl,
                             mi.raw, mi.nu, mi.kt, mi.ap, mi.al, mi.last_updated),
                            fetch=False)

        return mi

    def create_artist(self, manga_id: int) -> MangaArtist:
        author = next(iter(self.dbutil.add_authors([AuthorPartial(name=self.get_str_id())])))
        ma = MangaArtist(author_id=author.author_id, manga_id=manga_id)
        self.dbutil.add_manga_artists([ma])
        return ma

    def create_author(self, manga_id: int) -> MangaAuthor:
        author = next(iter(self.dbutil.add_authors([AuthorPartial(name=self.get_str_id())])))
        ma = MangaAuthor(author_id=author.author_id, manga_id=manga_id)
        self.dbutil.add_manga_authors([ma])
        return ma

    def get_manga_info(self, manga_id: int) -> MangaInfo | None:
        rows = self.dbutil.execute('SELECT * FROM manga_info WHERE manga_id=%s', (manga_id,))
        if not rows:
            return None

        return MangaInfo(
            **rows[0]
        )

    def create_aliases(self, manga_id: int, n: int) -> list[str]:
        aliases = [self.get_str_id() for _ in range(n)]
        sql = f"INSERT INTO manga_alias (manga_id, title) VALUES {','.join(('(%s, %s)',)*len(aliases))}"
        args: list = []
        for a in aliases:
            args.extend((manga_id, a))

        self.dbutil.execute(sql, args, fetch=False)
        return aliases

    def assertChaptersEqual(self, actual: Collection[Chapter], expected: Collection[Chapter]):
        for c in actual:
            c.chapter_id = None

        assert actual, expected

    def test_crashes_without_parameters(self):
        with pytest.raises(psycopg.errors.UndefinedFunction):
            self.dbutil.execute('SELECT * FROM merge_manga()')

    def test_crashes_with_invalid_parameters(self):
        with pytest.raises(psycopg.errors.InvalidTextRepresentation):
            self.dbutil.execute('SELECT * FROM merge_manga(%s, %s)', ('a', None))

        with pytest.raises(psycopg.errors.RaiseException):
            self.dbutil.execute('SELECT * FROM merge_manga(%s, %s)', (None, None))

        with pytest.raises(psycopg.errors.RaiseException):
            self.dbutil.execute('SELECT * FROM merge_manga(%s, %s)', (1, None))

        with pytest.raises(psycopg.errors.RaiseException):
            self.dbutil.execute('SELECT * FROM merge_manga(%s, %s)', (None, 1))

    def test_merges_manga_successfully(self):
        manga1 = self.create_manga_service()
        manga2 = self.create_manga_service()
        mi1 = self.create_manga_info(manga1, 1)
        self.create_manga_info(manga2, 2)

        result = self.merge_manga(manga1.manga_id, manga2.manga_id)
        assert result == MergeResult(alias_count=0, chapter_count=0)

        assert self.get_aliases(manga1.manga_id) == [manga2.title]

        assert self.get_manga_info(manga1.manga_id) == mi1

        assert self.get_manga_info(manga2.manga_id) is None

    def test_merges_chapters(self):
        manga1 = self.create_manga_service()
        manga2 = self.create_manga_service()

        c1 = self.create_db_chapter_objects(manga1, 3)
        c2 = self.create_db_chapter_objects(manga2, 3)
        self.dbutil.add_chapters([*c1, *c2], fetch=False)

        result = self.merge_manga(manga1.manga_id, manga2.manga_id)
        assert result == MergeResult(alias_count=0, chapter_count=3)

        # Set the expected manga id
        for c in c2:
            c.manga_id = manga1.manga_id

        self.assertChaptersEqual(
            self.dbutil.get_chapters(manga1.manga_id),
            [*c1, *c2]
        )

    def test_merges_aliases(self):
        manga1 = self.create_manga_service()
        manga2 = self.create_manga_service()

        aliases = self.create_aliases(manga2.manga_id, 5)
        sql = 'INSERT INTO manga_alias (manga_id, title) VALUES (%s, %s)'
        self.dbutil.execute(sql, (manga1.manga_id, aliases[0]), fetch=False)

        result = self.merge_manga(manga1.manga_id, manga2.manga_id)
        assert result == MergeResult(alias_count=4, chapter_count=0)

        assert_count_equals(self.get_aliases(manga1.manga_id), [*aliases, manga2.title])

    def test_merge_service_id(self):
        m1 = self.create_manga_service(DummyScraper)
        m2 = self.create_manga_service(DummyScraper2)
        mi2 = self.create_manga_info(m2, 2)

        m3 = m2.model_copy()
        m3.service_id = MangaPlus.ID
        self.dbutil.add_manga_service(m3)

        c1 = self.create_db_chapter_objects(m1, 3)
        c2 = self.create_db_chapter_objects(m2, 3)
        c3 = self.create_db_chapter_objects(m3, 3)
        self.dbutil.add_chapters([*c1, *c2, *c3], fetch=False)

        aliases = self.create_aliases(m2.manga_id, 5)
        aliases3 = self.create_aliases(m3.manga_id, 5)
        duplicate_alias = aliases[0]
        sql = 'INSERT INTO manga_alias (manga_id, title) VALUES (%s, %s)'
        self.dbutil.execute(sql, (m1.manga_id, duplicate_alias), fetch=False)

        result = self.merge_manga(m1.manga_id, m2.manga_id, m2.service_id)

        # Aliases should not be transferred in service specific operation
        assert result == MergeResult(alias_count=0, chapter_count=3)

        # Make sure one manga was not deleted or merged in any way
        assert self.dbutil.get_manga_service(m3.service_id, m3.title_id) == m3
        self.assertChaptersEqual(
            self.dbutil.get_chapters(m3.manga_id),
            c3
        )
        assert_count_equals(self.get_aliases(m3.manga_id), [*aliases3, *aliases])
        assert self.get_manga_info(m3.manga_id) == mi2

        # Assert the specific service was merged
        assert self.get_aliases(m1.manga_id) == [duplicate_alias]


        # Set the expected manga id
        for c in c2:
            c.manga_id = m1.manga_id

        self.assertChaptersEqual(
            self.dbutil.get_chapters(m1.manga_id),
            [*c1, *c2]
        )

        assert self.get_manga_info(m1.manga_id) is None

    def test_merge_author_artist_with_third_manga(self):
        m1 = self.create_manga_service(DummyScraper)
        m2 = self.create_manga_service(DummyScraper2)
        mar2 = self.create_artist(m2.manga_id)
        mau2 = self.create_author(m2.manga_id)

        m3 = m2.model_copy()
        m3.service_id = MangaPlus.ID
        self.dbutil.add_manga_service(m3)

        result = self.merge_manga(m1.manga_id, m2.manga_id, m2.service_id)

        # Aliases should not be transferred in service specific operation
        assert result == MergeResult(alias_count=0, chapter_count=0)

        # Make sure artists and authors not merged
        m_art = self.dbutil.get_manga_artists(m1.manga_id)
        assert m_art == [], 'Artists were merged when they should not have been'

        m_aut = self.dbutil.get_manga_authors(m1.manga_id)
        assert m_aut == [], 'Authors were transferred when they should not have been'

        # Make sure old artists and authors exist
        m_art = self.dbutil.get_manga_artists(m2.manga_id)
        assert m_art == [mar2]

        m_aut = self.dbutil.get_manga_authors(m2.manga_id)
        assert m_aut == [mau2]

    def test_merge_author_artist_successfully(self):
        m1 = self.create_manga_service(DummyScraper)
        m2 = self.create_manga_service(DummyScraper2)

        mar2 = self.create_artist(m2.manga_id)
        mar2.manga_id = m1.manga_id
        mau2 = self.create_author(m2.manga_id)
        mau2.manga_id = m1.manga_id

        result = self.merge_manga(m1.manga_id, m2.manga_id)

        # Aliases should not be transferred in service specific operation
        assert result == MergeResult(alias_count=0, chapter_count=0)

        # Make sure artists and authors not merged
        m_art = self.dbutil.get_manga_artists(m1.manga_id)
        assert m_art == [mar2]

        m_aut = self.dbutil.get_manga_authors(m1.manga_id)
        assert m_aut == [mau2]

        # Make sure old artists and authors exist
        m_art = self.dbutil.get_manga_artists(m2.manga_id)
        assert m_art == [], 'Artists were merged when they should not have been'

        m_aut = self.dbutil.get_manga_authors(m2.manga_id)
        assert m_aut == [], 'Authors were transferred when they should not have been'


if __name__ == '__main__':
    unittest.main()
