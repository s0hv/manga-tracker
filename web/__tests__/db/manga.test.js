import { getFollows, getAliases } from '../../db/manga';
import { HttpError } from '../../utils/errors';
import { normalUser, testManga } from '../utils';

afterAll(async () => {
  const { end } = require('../../db');
  await end();
});

describe('getFollows(userId)', () => {
  it('Returns followed manga with valid user', async () => {
    const follows = await getFollows(normalUser.userId);
    expect(follows).toBeDefined();
    expect(follows.length).toBeGreaterThan(0);
  });

  it('Throws http error on integer overflow', () => {
    expect.assertions(1);
    return expect(getFollows('1'.repeat(60)))
      .rejects
      .toEqual(HttpError(400, 'Integer out of range'));
  });

  it('Throws 404 when userId not defined', () => {
    expect.assertions(1);
    return expect(getFollows())
      .rejects
      .toEqual(HttpError(404));
  });

  it('Throws 400 when userId not a number', () => {
    expect.assertions(1);
    return expect(getFollows('x'))
      .rejects
      .toEqual(HttpError(400, 'Integer out of range'));
  });
});

describe('getAliases(mangaId)', () => {
  it('Returns aliases successfully', async () => {
    const aliases = await getAliases(testManga.mangaId);
    expect(aliases.map(a => a.title).sort()).toEqual(testManga.aliases.sort());
  });

  it('Returns empty list when manga not found', async () => {
    const aliases = await getAliases(0);
    expect(aliases).toHaveLength(0);
  });

  it('Throws when invalid integer is given', async () => {
    await expect(getAliases('a'))
      .rejects
      .toThrow();
    await expect(getAliases('1'.repeat(60)))
      .rejects
      .toThrow();
  });
});
