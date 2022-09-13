import { Manga, Cover } from 'mangadex-full-api';
import { mangadexLimiter, redis } from '../../utils/ratelimits';
import { db } from '../../db';
import { spyOnDb } from '../dbutils';

const { fetchExtraInfo } = jest.requireActual('../../db/mangadex');

afterAll(async () => {
  await db.end({ timeout: 10 });
  redis.disconnect();
});

describe('mangadex API works correctly', () => {
  beforeEach(() => {
    jest.spyOn(Manga, 'get')
      .mockImplementation(async () => ({ mainCover: {}}));
    jest.spyOn(Cover, 'get')
      .mockImplementation(async () => ({ imageSource: 'test' }));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await mangadexLimiter.delete('mangadex');
  });


  it('Does a database update on success', async () => {
    const dbSpy = spyOnDb('none');

    await fetchExtraInfo(1, 2);

    expect(dbSpy).toHaveBeenCalledTimes(2);
  });

  it('Does nothing when ratelimited', async () => {
    const dbSpy = spyOnDb('none');
    await expect(mangadexLimiter.consume('mangadex', 10))
      .rejects
      .toHaveProperty('msBeforeNext');

    await fetchExtraInfo(1, 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
  });

  it('Silently ignores mangadex errors', async () => {
    const err = new Error('test');
    const spy = jest.spyOn(Manga, 'get')
      .mockImplementation(async () => { throw err });
    const dbSpy = spyOnDb('none');

    await fetchExtraInfo(1, 2);

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });
});
