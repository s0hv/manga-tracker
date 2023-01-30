export const userForbidden = 'Forbidden to perform this action';
export const userUnauthorized = 'User not authenticated';
export const mangaIdError = 'Manga id must be a positive integer';
export const invalidValue = 'Invalid value';
export const ISE = 'Internal server error';

export const csrfToken = 'test-csrf-token';

export const defaultDateFormatRegex = '\\w{3} \\d{1,2}\\w{2} \\d+, \\d{2}:\\d{2}';
export const defaultDateDistanceFormat = '\\d+ \\w+';

export const testChapterUrlFormat = 'https://test-url.com/chapter/{}';

export const isCI = /^(y|yes|true)$/i.test(process.env.IS_CI);

export const fullManga = {
  manga: {
    mangaId: 1,
    title: 'Dr. STONE',
    releaseInterval: {
      days: 7,
    },
    latestRelease: '2020-07-05T16:00:00.000Z',
    estimatedRelease: '2020-07-12T16:00:00.000Z',
    latestChapter: 157,
    cover: '/images/test.png',
    status: 0,
    artist: 'Boichi',
    author: 'Inagaki Riichiro',
    lastUpdated: '2020-06-28T08:15:55.170Z',
    bw: 'https://bookwalker.jp/series/114645',
    mu: 'https://www.mangaupdates.com/series.html?id=139601',
    mal: 'https://myanimelist.net/manga/103897',
    amz: 'https://www.amazon.co.jp/gp/product/B075F8JBQ1',
    ebj: 'https://www.ebookjapan.jp/ebj/413780/',
    engtl: 'https://www.viz.com/dr-stone',
    raw: 'null',
    nu: 'https://www.novelupdates.com/series/null',
    kt: 'https://kitsu.io/manga/38860',
    ap: 'https://www.anime-planet.com/manga/dr-stone',
    al: 'https://anilist.co/manga/98416',
  },

  services: [
    {
      titleId: '100010',
      serviceId: 1,
      name: 'MANGA Plus',
      urlFormat: 'https://mangaplus.shueisha.co.jp/viewer/{}',
      url: 'https://mangaplus.shueisha.co.jp/titles/{}',
    },
    {
      titleId: '20882',
      serviceId: 2,
      name: 'MangaDex',
      urlFormat: 'https://mangadex.org/chapter/{}',
      url: 'https://mangadex.org/title/{}',
    },
  ],

  chapters: [
    {
      title: 'Z=157: Same Time, Same Place',
      chapterNumber: 157,
      releaseDate: new Date(1593964800000),
      group: 'Shueisha',
      serviceId: 1,
      chapterIdentifier: '1007322',
    },
    {
      title: 'Z=156: Two Scientists',
      chapterNumber: 156,
      releaseDate: null,
      group: 'MangaPlus',
      serviceId: 2,
      chapterIdentifier: '938629',
    },
    {
      title: 'Z=156: Two Scientists',
      chapterNumber: 156,
      releaseDate: new Date(1593187200000),
      group: 'Shueisha',
      serviceId: 1,
      chapterIdentifier: '1007024',
    },
  ],

  aliases: ['test alias'],
};

export const emptyFullManga = {
  manga: {
    mangaId: 2,
    title: 'Dr. STONE 2',
    releaseInterval: undefined,
    latestRelease: null,
    estimatedRelease: null,
    latestChapter: null,
    cover: null,
    status: 0,
    artist: 'Boichi',
    author: 'Inagaki Riichiro',
    lastUpdated: null,
    bw: 'https://bookwalker.jp/series/114645',
    mu: 'https://www.mangaupdates.com/series.html?id=139601',
    mal: null,
    amz: 'https://www.amazon.co.jp/gp/product/B075F8JBQ1',
    ebj: 'https://www.ebookjapan.jp/ebj/413780/',
    engtl: 'https://www.viz.com/dr-stone',
    raw: 'null',
    nu: 'https://www.novelupdates.com/series/null',
    kt: 'https://kitsu.io/manga/38860',
    ap: 'https://www.anime-planet.com/manga/dr-stone',
    al: 'https://anilist.co/manga/98416',
  },

  services: [
    {
      titleId: '100010',
      serviceId: 1,
      name: 'MANGA Plus',
      urlFormat: 'https://mangaplus.shueisha.co.jp/viewer/{}',
      url: 'https://mangaplus.shueisha.co.jp/titles/{}',
    },
  ],

  chapters: [],
};
