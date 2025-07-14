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

afterAll(async () => {
  redis.disconnect();
});

describe('mangadex API works correctly', () => {
  beforeEach(() => {
    vi.spyOn(Manga, 'get')
      .mockImplementation(async () => ({ mainCover: {}} as unknown as any));
    vi.spyOn(Cover, 'get')
      .mockImplementation(async () => ({ imageSource: 'test' } as unknown as any));
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
      .mockImplementation(async () => { throw err });
    const dbSpy = spyOnDb('none');

    await fetchExtraInfo('1', 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });
});
