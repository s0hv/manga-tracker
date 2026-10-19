import { Cover, Manga } from 'mangadex-full-api';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as z from 'zod';

import { createManga, spyOnDb } from '../dbutils';
import { db, sql, voidSql } from '@/db/index';
import { mangadexLimiter, redis } from '@/serverUtils/ratelimits';


const { fetchExtraInfo } = await vi.importActual<typeof import('@/db/mangadex')>('@/db/mangadex');

const expectedCoverUrl = 'https://uploads.mangadex.org/covers/test/test';

const getCover = (mangaId: number) => db.maybeOneFirst(
  sql.type(z.object({ cover: z.string().nullable() }))`SELECT cover FROM manga_info WHERE manga_id=${mangaId}`
);

afterAll(() => {
  redis.disconnect();
});

describe('mangadex API works correctly', () => {
  beforeEach(() => {
    vi.spyOn(Manga, 'get')

      .mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({
          mainCover: {},
        } satisfies Partial<Omit<Manga, 'mainCover'>> & { mainCover: Partial<Manga['mainCover']> } as Manga
        )
      );
    vi.spyOn(Cover, 'get')
      .mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({
          fileName: 'test',
          manga: { id: 'test' },
        }) satisfies Partial<Omit<Cover, 'manga'>> & { manga: Partial<Cover['manga']> } as Cover
      );
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await mangadexLimiter.delete('mangadex');
  });


  it('Updates the cover of an existing manga_info row on success', async () => {
    const mangaId = await createManga();
    await db.query(voidSql`INSERT INTO manga_info (manga_id) VALUES (${mangaId})`);
    const dbSpy = spyOnDb('query');

    await fetchExtraInfo('1', mangaId);

    // Scheduled run insert + manga_info update
    expect(dbSpy).toHaveBeenCalledTimes(2);
    expect(await getCover(mangaId)).toBe(expectedCoverUrl);
  });

  it('Creates the manga_info row with the cover when it does not exist', async () => {
    const mangaId = await createManga();
    expect(await getCover(mangaId)).toBeNull();
    const dbSpy = spyOnDb('query');

    await fetchExtraInfo('1', mangaId);

    // Scheduled run insert + manga_info update + manga_info insert
    expect(dbSpy).toHaveBeenCalledTimes(3);
    expect(await getCover(mangaId)).toBe(expectedCoverUrl);
  });

  it('Does nothing when ratelimited', async () => {
    const dbSpy = spyOnDb('query');
    await expect(mangadexLimiter.consume('mangadex', 10))
      .rejects
      .toHaveProperty('msBeforeNext');

    await fetchExtraInfo('1', 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
  });

  it('Silently ignores mangadex errors', async () => {
    const err = new Error('test');
    const spy = vi.spyOn(Manga, 'get')
      // Mock needs to return a promise
      // eslint-disable-next-line @typescript-eslint/require-await
      .mockImplementation(async () => { throw err });
    const dbSpy = spyOnDb('query');

    await fetchExtraInfo('1', 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });
});
