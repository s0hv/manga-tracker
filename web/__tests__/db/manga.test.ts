import { beforeAll, describe, expect, it } from 'vitest';

import { createManga } from '../dbutils';
import { normalUser, testManga } from '../utils';
import { MangaStatus } from '@/common/mangaStatus';
import { db, voidSql } from '@/db/index';
import { getAliases, getFollows, getMangasForSearch } from '@/db/manga';
import { HttpError } from '@/serverUtils/errors';

let titleIdCounter = 0;
const addMangaService = async (mangaId: number, serviceId: number) => {
  const titleId = `search-test-${Date.now()}-${titleIdCounter++}`;
  await db.query(voidSql`INSERT INTO manga_service (manga_id, service_id, title_id, feed_url)
    VALUES (${mangaId}, ${serviceId}, ${titleId}, ${titleId})`);
};

const addMangaInfo = async (mangaId: number, status: MangaStatus, cover: string | null = null) => {
  await db.query(voidSql`INSERT INTO manga_info (manga_id, status, cover) VALUES (${mangaId}, ${status}, ${cover})`);
};


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
    // @ts-expect-error
    return expect(getFollows())
      .rejects
      .toEqual(HttpError(404));
  });

  it('Throws 400 when userId not a number', () => {
    expect.assertions(1);
    return expect(getFollows('x'))
      .rejects
      .toEqual(HttpError(400, 'Invalid integer'));
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

describe('getMangasForSearch', () => {
  const cover = 'https://example.com/cover.jpg';

  // completedManga: services 1 and 2, completed, has a cover
  // noInfoManga: service 1, no manga_info row
  // hiatusManga: service 2, on hiatus
  let completedManga: number;
  let noInfoManga: number;
  let hiatusManga: number;
  // Mimics the relevance order returned by elasticsearch
  let mangaIds: number[];

  beforeAll(async () => {
    completedManga = await createManga();
    await addMangaService(completedManga, 1);
    await addMangaService(completedManga, 2);
    await addMangaInfo(completedManga, MangaStatus.COMPLETED, cover);

    noInfoManga = await createManga();
    await addMangaService(noInfoManga, 1);

    hiatusManga = await createManga();
    await addMangaService(hiatusManga, 2);
    await addMangaInfo(hiatusManga, MangaStatus.HIATUS);

    mangaIds = [hiatusManga, completedManga, noInfoManga];
  });

  it('Returns the mangas in the order of the given ids with their info', async () => {
    const result = await getMangasForSearch({ mangaIds, limit: 10 });

    expect(result.count).toBe(3);
    expect([...result.foundServiceIds].sort()).toEqual([1, 2]);
    expect(result.mangas.map(m => m.mangaId)).toEqual(mangaIds);

    const [hiatus, completed, noInfo] = result.mangas;

    expect(completed).toEqual({
      mangaId: completedManga,
      title: 'test',
      coverUrl: cover,
      latestChapter: null,
      latestRelease: null,
      status: MangaStatus.COMPLETED,
      serviceIds: expect.toIncludeSameMembers([1, 2]),
    });
    expect(hiatus).toMatchObject({ status: MangaStatus.HIATUS, coverUrl: null, serviceIds: [2]});
    expect(noInfo).toMatchObject({ status: null, coverUrl: null, serviceIds: [1]});
  });

  it('Filters by service ids while still returning every found service id', async () => {
    const result = await getMangasForSearch({ mangaIds, serviceIds: [2], limit: 10 });

    expect(result.mangas.map(m => m.mangaId)).toEqual([hiatusManga, completedManga]);
    expect(result.count).toBe(2);
    // The found service ids are used as the filter options, so filtering must not remove them
    expect([...result.foundServiceIds].sort()).toEqual([1, 2]);
  });

  it('Counts a manga matching multiple filtered services only once', async () => {
    const result = await getMangasForSearch({ mangaIds, serviceIds: [1, 2], limit: 10 });

    expect(result.mangas.map(m => m.mangaId)).toEqual(mangaIds);
    expect(result.count).toBe(3);
  });

  it('Filters by status', async () => {
    const result = await getMangasForSearch({
      mangaIds,
      mangaStatus: [MangaStatus.COMPLETED, MangaStatus.HIATUS],
      limit: 10,
    });

    expect(result.mangas.map(m => m.mangaId)).toEqual([hiatusManga, completedManga]);
    expect(result.count).toBe(2);

    // A manga without a manga_info row has no status, so it never matches a status filter
    const ongoing = await getMangasForSearch({ mangaIds, mangaStatus: [MangaStatus.ONGOING], limit: 10 });
    expect(ongoing.mangas).toHaveLength(0);
    expect(ongoing.count).toBe(0);
  });

  it('Combines service and status filters', async () => {
    const result = await getMangasForSearch({
      mangaIds,
      serviceIds: [1],
      mangaStatus: [MangaStatus.COMPLETED, MangaStatus.HIATUS],
      limit: 10,
    });

    expect(result.mangas.map(m => m.mangaId)).toEqual([completedManga]);
    expect(result.count).toBe(1);
  });

  it('Paginates with limit and offset without affecting the count', async () => {
    const firstPage = await getMangasForSearch({ mangaIds, limit: 2 });
    expect(firstPage.mangas.map(m => m.mangaId)).toEqual([hiatusManga, completedManga]);
    expect(firstPage.count).toBe(3);

    const secondPage = await getMangasForSearch({ mangaIds, limit: 2, offset: 2 });
    expect(secondPage.mangas.map(m => m.mangaId)).toEqual([noInfoManga]);
    expect(secondPage.count).toBe(3);
  });

  it('Returns nothing when no ids are given', async () => {
    const result = await getMangasForSearch({ mangaIds: [], limit: 10 });

    expect(result).toEqual({ count: 0, foundServiceIds: [], mangas: []});
  });
});
