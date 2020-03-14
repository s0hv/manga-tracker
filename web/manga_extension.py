from feedgen.ext.base import BaseEntryExtension, BaseExtension
from lxml import etree

MANGA_NS = 'mangaInfo'


class MangaExtension(BaseExtension):
    def extend_ns(self):
        return {'manga': MANGA_NS}


class MangaEntryExtension(BaseEntryExtension):
    def __init__(self):
        self.__manga_id = None

    def extend_rss(self, entry):
        if self.__manga_id:
            manga_id = etree.SubElement(entry, '{%s}id' % MANGA_NS)
            print(manga_id)
            manga_id.text = self.__manga_id

    def manga_id(self, manga_id=None):
        self.__manga_id = manga_id
