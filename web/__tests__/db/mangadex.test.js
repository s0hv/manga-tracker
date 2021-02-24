import { Manga } from 'mangadex-full-api';
import fs from 'fs';
import * as path from 'path';
import { mangadexLimiter, redis } from '../../utils/ratelimits';
import db from '../../db';

const { fetchExtraInfo } = jest.requireActual('../../db/mangadex');

afterAll(async () => {
  redis.disconnect();
  await db.pool.end();
});

describe('mangadex API works correctly', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mangadexLimiter.delete('mangadex');
  });

  const flushPromises = () => new Promise(setImmediate);
  const mockManga = new Manga(1);

  const data = fs.readFileSync(path.join(__dirname, 'mangadex.json'), { encoding: 'utf-8' }).toString('utf-8');
  expect(() => mockManga._parse(JSON.parse(data))).not.toThrow();

  it('Does a database update on success', async () => {
    const spy = jest.spyOn(Manga.prototype, 'fill')
      .mockImplementation(async () => mockManga);
    const dbSpy = jest.spyOn(db, 'query');

    await fetchExtraInfo(1, 1, [], false);
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledTimes(1);
  });

  it('Does a database update on success with chapters', async () => {
    const spy = jest.spyOn(Manga.prototype, 'fill')
      .mockImplementation(async () => mockManga);
    const dbSpy = jest.spyOn(db, 'query');

    await fetchExtraInfo(1, 1, []);
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledTimes(2);
  });

  it('Does a database update on success with all duplicate chapters', async () => {
    const spy = jest.spyOn(Manga.prototype, 'fill')
      .mockImplementation(async () => mockManga);
    const dbSpy = jest.spyOn(db, 'query');

    await fetchExtraInfo(1, 1, ['1', '2', '3', '4', '5']);
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(dbSpy).toHaveBeenCalledTimes(1);
  });

  it('Does nothing when ratelimited', async () => {
    const spy = jest.spyOn(Manga.prototype, 'fill')
      .mockImplementation(async () => mockManga);

    await expect(mangadexLimiter.consume('mangadex', 10))
      .rejects
      .toHaveProperty('msBeforeNext');

    await fetchExtraInfo(1, 1);
    await flushPromises();

    expect(spy).not.toHaveBeenCalled();
  });

  it('Silently ignores mangadex errors', async () => {
    const err = new Error('test');
    const spy = jest.spyOn(Manga.prototype, 'fill')
      .mockImplementation(async () => throw err);
    const dbSpy = jest.spyOn(db, 'query');

    await fetchExtraInfo(1, 1);
    await flushPromises();

    expect(dbSpy).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });
});
