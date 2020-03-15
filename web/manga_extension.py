from feedgen.ext.base import BaseEntryExtension, BaseExtension
from lxml import etree

MANGA_NS = 'mangaInfo'


class MangaExtension(BaseExtension):
    def extend_ns(self):
        return {'manga': MANGA_NS}


class MangaEntryExtension(BaseEntryExtension):
    def __init__(self):
        self.__id = None
        self.__title = None

    def extend_rss(self, entry):
        if self.__id:
            manga_id = etree.SubElement(entry, '{%s}id' % MANGA_NS)
            manga_id.text = self.__id

        if self.__title:
            etree.SubElement(entry, '{%s}title' % MANGA_NS).text = self.__title

    def manga_id(self, manga_id=None):
        self.__id = manga_id

    def manga_title(self, title=None):
        self.__title = title
