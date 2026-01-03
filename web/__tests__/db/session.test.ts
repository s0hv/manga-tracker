import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createTestSession, spyOnDb } from '../dbutils';
import { getIncrementalStringGenerator } from '@/tests/utils';
import { db } from '#server/db/helpers';
import {
  clearOldSessions,
  createSession,
  deleteSession,
  getSession,
  sessionCache,
  setSessionClearInterval,
} from '#server/db/session';
import { hashSecret } from '@/serverUtils/utilities';
import type { Session } from '@/types/session';


vi.mock('@/serverUtils/view-counter', async (): Promise<typeof import('#server/utils/view-counter')> => {
  const module = await vi.importActual<typeof import('#server/utils/view-counter')>('@/serverUtils/view-counter');
  return {
    ...module,
    onSessionExpire: vi.fn().mockImplementation(module.onSessionExpire),
  };
});

afterEach(() => {
  sessionCache.clear();
  setSessionClearInterval(null);
});

describe('Getting sessions', () => {
  it('Returns null when session not found', async () => {
    await expect(getSession('no sid')).resolves.toBeNull();
    await expect(getSession('')).resolves.toBeNull();
  });

  it('Returns session when found from database and saves it to cache', async () => {
    const spy = spyOnDb('oneOrNone');
    const sid = Date.now().toString();

    await createTestSession(sid);
    const sessionData = await getSession(sid);

    expect(sessionData).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);

    // Make sure found session was cached
    expect(sessionCache.get(sid)).toEqual(sessionData);
  });

  it('Returns session without database calls when it is in cache', async () => {
    const spy = spyOnDb('oneOrNone');
    const sid = Date.now().toString();

    await createTestSession(sid);
    // Get session 3 times
    await getSession(sid);
    await getSession(sid);
    await getSession(sid);

    // Db should have been called only once
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Clears expired sessions on get', async () => {
    const sid = Date.now().toString();

    await createTestSession(sid);
    // Make the session expire now
    await db.none`UPDATE sessions SET expires_at = ${new Date()} WHERE session_id = ${sid}`;

    const spy = spyOnDb('oneOrNone');

    await expect(getSession(sid)).resolves.toBeNull();
    expect(sessionCache.get(sid)).toBeUndefined();

    // DB should be called once for fetch and once for delete
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('Setting sessions', () => {
  it('Saves new session to database', async () => {
    const oneOrNoneSpy = spyOnDb('oneOrNone');
    const noneSpy = spyOnDb('none');

    const { sessionId, token } = await createSession(null);

    // Token should be long enough
    expect(token.length).toBeGreaterThan(30);
    await expect(getSession(sessionId)).resolves.not.toBeNull();

    expect(noneSpy).toHaveBeenCalledTimes(1);
    // createSession does not set anything to cache se we expect a fetch here
    expect(oneOrNoneSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Deleting sessions', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('Deletes session from database and cache', async () => {
    const sid = Date.now().toString();
    await createTestSession(sid);
    // Fetch session so it is in the cache
    await getSession(sid);

    await deleteSession(sid);
    const spy = spyOnDb('oneOrNone');

    expect(sessionCache.get(sid)).toBeUndefined();
    await expect(getSession(sid)).resolves.toBeNull();

    console.log(spy.mock.calls);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Clear old sessions clears sessions from db and cache', async () => {
    // First, clear all other old sessions leftover by earlier tests
    await clearOldSessions();

    const sid = Date.now().toString();
    await createTestSession(sid);
    await expect(getSession(sid)).resolves.not.toBeNull();

    // Make the session expire now
    await db.none`UPDATE sessions SET expires_at = ${new Date()} WHERE session_id = ${sid}`;

    const mangaViews = await import('#server/utils/view-counter');
    const spy = vi.spyOn(mangaViews, 'onSessionExpire');

    await clearOldSessions();

    expect(sessionCache.get(sid)).toBeUndefined();
    await expect(getSession(sid)).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Calls clearOldSessions automatically with the given interval', { timeout: 20_000 }, async () => {
    // First, create the test session
    const sid = Date.now().toString();
    await createTestSession(sid);
    // Populate cache by fetching the session
    await getSession(sid);
    // Make the session expire now
    await db.none`UPDATE sessions SET expires_at = ${new Date()} WHERE session_id = ${sid}`;
    const clearSessionsSpy = vi.fn<typeof clearOldSessions>(() => clearOldSessions());

    vi.useFakeTimers();

    const clearIntervalMs = 1000;
    setSessionClearInterval(clearIntervalMs, clearSessionsSpy);

    await vi.advanceTimersByTimeAsync(clearIntervalMs - 10);
    expect(clearSessionsSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    expect(clearSessionsSpy).toHaveBeenCalledTimes(1);

    // Clear the interval and finish pending promises
    setSessionClearInterval(null);
    await vi.runAllTimersAsync();

    // Clear should have been called only once
    expect(clearSessionsSpy).toHaveBeenCalledTimes(1);

    // Switch to real timers to avoid hangup with await
    vi.useRealTimers();

    // Session should be removed from the cache
    await vi.waitFor(() => expect(sessionCache.get(sid)).toBeUndefined());
    await expect(getSession(sid)).resolves.toBeNull();
  });
});

describe('clearOldSessions and manga views', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createData = (mangaId: number, views: number): Session['data'] => ({
    mangaViews: {
      [mangaId]: views,
    },
  });

  const sidGen = getIncrementalStringGenerator('sessionId');

  async function createSessionWithData(data: Session['data']) {
    const sessionSecret = 'testSessionSecret';
    const expiresAt = new Date();
    const sessionId = `${Date.now()}_${sidGen()}`;

    const sessionData: Session = {
      userId: null,
      sessionId,
      expiresAt,
      data,
      sessionSecret: await hashSecret(sessionSecret),
    };

    await db.none`INSERT INTO sessions ${db.sql(sessionData)}`;
  }

  it('mergeSessionViews merges sessions correctly', async () => {
    // First, clear all other old sessions leftover by earlier tests
    await clearOldSessions();
    // Reset manga views
    await db.none`UPDATE manga SET views = 0`;

    const rowDatas: Session['data'][] = [
      createData(1, 2),
      createData(1, 1),
      createData(2, 4),
      {
        mangaViews: {
          1: 1,
          2: 2,
          3: 1,
        },
      },
      {},
      null,
    ];

    const expectedMangaViews = {
      1: 3,
      2: 2,
      3: 1,
    };

    // Validate that the manually set views match the row data
    const expectedFromRows = rowDatas
      .flatMap(row => Object.keys(row?.mangaViews ?? {}))
      .reduce<Record<string, number>>((acc, row) => ({
        ...acc,
        [row]: (acc[row] ?? 0) + 1,
      }), {});

    expect(expectedMangaViews).toEqual(expectedFromRows);

    // Create sessions with data
    await Promise.all(rowDatas.map(createSessionWithData));

    const mangaViews = await import('#server/utils/view-counter');
    const viewsSpy = mangaViews.onSessionExpire as Mock<typeof mangaViews.onSessionExpire>;
    const dbSpy = spyOnDb('manyOrNone');
    const sessionClearIntervalMs = 1000;

    vi.useFakeTimers();

    setSessionClearInterval(sessionClearIntervalMs);
    await vi.advanceTimersByTimeAsync(sessionClearIntervalMs + 10);

    // Clear the interval and finish pending promises
    setSessionClearInterval(null);
    await vi.runAllTimersAsync();

    // Switch to real timers to avoid hangup with await
    vi.useRealTimers();

    expect(dbSpy).toHaveBeenCalledTimes(1);
    // Wait until views updating is completed
    await vi.waitFor(() => expect(viewsSpy).toHaveBeenCalledTimes(rowDatas.length));

    type MangaResult = {
      mangaId: number
      views: number
    };
    const modifiedManga = await db.many<MangaResult>`SELECT manga_id, views FROM manga WHERE manga_id IN ${db.sql(Object.keys(expectedMangaViews))}`;
    const actualMangaViews = Object.fromEntries(
      modifiedManga.map(({ mangaId, views }) => [mangaId, views])
    );

    // Make sure the manga views were updated correctly
    expect(expectedMangaViews).toEqual(actualMangaViews);

    for (const row of rowDatas) {
      expect(viewsSpy).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: expect.any(String),
        data: row,
      }));
    }
  });
});
