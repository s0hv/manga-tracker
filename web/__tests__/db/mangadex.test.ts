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

import { spyOnDb } from '../dbutils';
import { mangadexLimiter, redis } from '@/serverUtils/ratelimits';


const { fetchExtraInfo } = await vi.importActual<typeof import('@/db/mangadex')>('@/db/mangadex');

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


  it('Does a database update on success', async () => {
    const dbSpy = spyOnDb('none');

    await fetchExtraInfo('1', 2);

    expect(dbSpy).toHaveBeenCalledTimes(2);
  });

  it('Does nothing when ratelimited', async () => {
    const dbSpy = spyOnDb('none');
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
    const dbSpy = spyOnDb('none');

    await fetchExtraInfo('1', 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });
});
