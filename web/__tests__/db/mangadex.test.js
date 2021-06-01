import { Manga, Cover } from 'mangadex-full-api';
import { mangadexLimiter, redis } from '../../utils/ratelimits';
import { pgp } from '../../db';
import { spyOnDb } from '../dbutils';

const { fetchExtraInfo } = jest.requireActual('../../db/mangadex');

afterAll(async () => {
  await pgp.end();
  redis.disconnect();
});

describe('mangadex API works correctly', () => {
  beforeEach(() => {
    jest.spyOn(Manga, 'get')
      .mockImplementation(async () => ({ mainCover: {}}));
    jest.spyOn(Cover, 'get')
      .mockImplementation(async () => ({ imageSource: 'test' }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });


  it('Does a database update on success', async () => {
    const dbSpy = spyOnDb();

    await fetchExtraInfo(1, 1);

    expect(dbSpy).toHaveBeenCalledTimes(2);
  });

  it('Does nothing when ratelimited', async () => {
    const dbSpy = spyOnDb();
    await expect(mangadexLimiter.consume('mangadex', 10))
      .rejects
      .toHaveProperty('msBeforeNext');

    await fetchExtraInfo(1, 1);

    expect(dbSpy).toHaveBeenCalledTimes(1);
  });

  it('Silently ignores mangadex errors', async () => {
    const err = new Error('test');
    const spy = jest.spyOn(Manga, 'get')
      .mockImplementation(async () => throw err);
    const dbSpy = spyOnDb();

    await fetchExtraInfo(1, 1);

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });
});
