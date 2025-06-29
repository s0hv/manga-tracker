import type { FullMangaData } from '@/types/api/manga';
import type { User } from '@/types/db/user';
import type { SessionUser } from '@/types/dbTypes';

export type TestUser = User & SessionUser & {
  joinedAt: Date
  password: string
  email: string
};
export const userForbidden = 'Forbidden to perform this action';
export const userUnauthorized = 'User not authenticated';
export const mangaIdError = 'Manga id must be a positive integer';
export const invalidValue = 'Invalid value';
export const ISE = 'Internal server error';

export const csrfToken = 'test-csrf-token';

export const defaultDateFormatRegex = '\\w{3} \\d{1,2}\\w{2} \\d+, \\d{2}:\\d{2}';
export const defaultDateDistanceFormat = '\\d+ \\w+';

export const testChapterUrlFormat = 'https://test-url.com/chapter/{}';

export const isCI = /^(y|yes|true)$/i.test(process.env.IS_CI || '');

export const fullManga: FullMangaData = {
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

  aliases: ['test alias'],
};

export const emptyFullManga: FullMangaData = {
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
};

export const adminUser: TestUser = {
  userId: 1,
  userUuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  uuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  id: '22fc15c9-37b9-4869-af86-b334333dedd8',
  username: 'test ci admin',
  joinedAt: new Date(Date.now()),
  theme: 'dark',
  admin: true,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test-admin@test.com',
  isCredentialsAccount: true,
};

export const normalUser: TestUser = {
  userId: 3,
  userUuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  uuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  id: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  username: 'test ci',
  joinedAt: new Date(Date.now()),
  theme: 'dark',
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test@test.com',
  isCredentialsAccount: true,
};

export const authTestUser: TestUser = {
  userId: 3,
  userUuid: 'db598f65-c558-4205-937f-b0f149dda1fa',
  uuid: 'db598f65-c558-4205-937f-b0f149dda1fa',
  id: 'db598f65-c558-4205-937f-b0f149dda1fa',
  username: 'test ci auth',
  joinedAt: new Date(Date.now()),
  theme: 'dark',
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test_auth@test.com',
  isCredentialsAccount: true,
};

export const oauthUser: TestUser = {
  userId: 5,
  userUuid: 'd1e3395a-37fa-4df7-8441-46d2b2689788',
  uuid: 'd1e3395a-37fa-4df7-8441-46d2b2689788',
  id: 'd1e3395a-37fa-4df7-8441-46d2b2689788',
  username: 'test oauth',
  joinedAt: new Date(Date.now()),
  theme: 'dark',
  admin: false,
  password: '',
  email: 'test@oauth.com',
  isCredentialsAccount: false,
};
