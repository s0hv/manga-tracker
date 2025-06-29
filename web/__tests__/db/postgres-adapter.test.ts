import { faker } from '@faker-js/faker';
import type { AdapterSession } from 'next-auth/adapters';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { spyOnDb } from '../dbutils';
import { mockUTCDates, normalUser } from '../utils';
import { db } from '@/db/helpers';
import { PostgresAdapter } from '@/db/postgres-adapter';
import { SessionData } from '@/types/dbTypes';


faker.seed(42);

vi.mock('@/serverUtils/view-counter/manga-view-counter', async () => ({
  ...await vi.importActual<typeof import('@/serverUtils/view-counter/manga-view-counter')>('@/serverUtils/view-counter/manga-view-counter'),
}));

describe('PostgresAdapter', () => {
  mockUTCDates();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    mockUTCDates();
  });

  it('Throws error when connection not given to constructor', () => {
    // @ts-expect-error
    expect(() => PostgresAdapter()).toThrow(/Db helpers must be given as the first parameter/i);
  });

  it('Constructs class with default values', () => {
    expect(() => PostgresAdapter(db)).not.toThrow();
  });

  it('Uses options given to the constructor', () => {
    const cacheSize = 10;
    const maxAge = 50000;
    const cacheOpts = {
      cacheSize,
      maxAge,
    };
    const adapter = PostgresAdapter(db, {
      sessionCacheOpts: cacheOpts,
      userCacheOpts: cacheOpts,
    });

    expect(adapter.userCache.ttl).toStrictEqual(maxAge);
    expect(adapter.userCache.max).toStrictEqual(cacheSize);

    expect(adapter.sessionCache.ttl).toStrictEqual(maxAge);
    expect(adapter.sessionCache.max).toStrictEqual(cacheSize);
  });

  describe('Getting sessions', () => {
    it('Returns nothing when session not found', async () => {
      expect.assertions(1);
      const adapter = PostgresAdapter(db);
      await expect(adapter.getSessionAndUser('no sid'))
        .resolves
        .toBeNull();
    });

    it('Returns session when found from database and saves it to cache', async () => {
      const spy = spyOnDb('oneOrNone');
      const adapter = PostgresAdapter(db);
      const sid = faker.datatype.uuid();
      const session = { test: 1, data: 'data' };
      const expires = new Date(Date.now() + 60 * 60 * 60);

      // Delete existing session and add new one
      await db.sql`DELETE FROM sessions WHERE session_id=${sid}`;
      await db.sql`INSERT INTO sessions (user_id, session_id, expires_at, data) VALUES (${normalUser.id}, ${sid}, ${expires}, ${db.sql.json(session)})`;

      const expected = {
        sessionToken: sid,
        expires,
        userId: normalUser.id,
        data: session,
      };

      await expect(adapter.getSession(sid))
        .resolves
        .toEqual(expected);

      expect(spy).toHaveBeenCalledTimes(1);

      // Make sure found session was cached
      expect(adapter.sessionCache.get(sid)).toEqual(expected);
    });

    it('Returns session without database calls when it is in cache', async () => {
      const spy = spyOnDb();
      const adapter = PostgresAdapter(db);
      const sid = faker.datatype.uuid();
      const session: AdapterSession = {
        expires: new Date(),
        sessionToken: sid,
        userId: normalUser.id,
        data: { test: 1, data: 'data' },
      };

      adapter.sessionCache.set(sid, session, { ttl: 60 * 60 * 60 });

      await expect(adapter.getSession(sid))
        .resolves
        .toEqual(session);

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('Returns error on database errors', async () => {
      const error = new Error('test');
      const spy = spyOnDb('oneOrNone').mockImplementation(async () => { throw error });
      const adapter = PostgresAdapter(db);
      const sid = faker.datatype.uuid();

      await expect(adapter.getSession(sid))
        .rejects
        .toEqual(error);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Setting sessions', () => {
    const session = {
      userId: normalUser.id,
      expires: new Date(Date.now() + 60 * 60 * 60),
      data: {
        test: 1,
        data: 'data',
      },
    } satisfies Partial<AdapterSession>;

    it('Saves new session to database and cache', async () => {
      const spy = spyOnDb();
      const adapter = PostgresAdapter(db);
      const sid = faker.datatype.uuid();
      await adapter.deleteSession(sid);

      const expected: AdapterSession = { ...session, sessionToken: sid };
      await expect(adapter.createSession(expected))
        .resolves
        .toEqual(expected);

      // Once for delete, once for insert
      expect(spy).toHaveBeenCalledTimes(2);
      // Cache is only set on get
      expect(adapter.sessionCache.get(sid)).toBeUndefined();
    });

    it('Returns error on database errors while still setting cache', async () => {
      const error = new Error('test');
      const spy = spyOnDb('one').mockImplementation(async () => { throw error });
      const adapter = PostgresAdapter(db);
      const sid = faker.datatype.uuid();
      await adapter.deleteSession(sid);

      await expect(adapter.createSession({ ...session, sessionToken: sid }))
        .rejects
        .toEqual(error);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(adapter.sessionCache.get(sid)).toBeUndefined();
    });
  });

  describe('clearOldSessions', () => {
    it.skip('mergeSessionViews merges sessions correctly', async () => {
      vi.useFakeTimers();

      const createData = (mangaId: number, views: number) => ({ data: { mangaViews: { [mangaId]: views }}});
      const rows = [
        createData(1, 2),
        createData(1, 1),
        createData(2, 4),
        { data: {}},
        {
          data: {
            mangaViews: {
              1: 1,
              2: 2,
              3: 1,
            },
          },
        },
      ];

      const expected: SessionData = {
        mangaViews: {
          1: 4,
          2: 6,
          3: 1,
        },
      };

      const mangaViews = await import('../../server/utils/view-counter/manga-view-counter');

      const dbSpy = spyOnDb('any').mockImplementation(async () => rows);
      const sessionClearInterval = 1000;
      const adapter = PostgresAdapter(db, { clearInterval: sessionClearInterval });
      const sessionSpy = vi.spyOn(adapter, 'clearOldSessions');

      // This must be wrapped with done since otherwise the callback is not used in evaluation
      const promise = new Promise<void>((done, reject) => vi.spyOn(mangaViews, 'onSessionExpire')
        .mockImplementation(async (sess: SessionData | null) => {
          expect(adapter.clearInterval).not.toBeNull();
          clearInterval(adapter.clearInterval!);

          try {
            expect(sess).toEqual(expected);
            done();
          } catch (err) {
            reject(err);
          }
          vi.runAllTimers();
          vi.useRealTimers();
        }));

      vi.advanceTimersByTime(sessionClearInterval + 10);
      await promise;

      expect(dbSpy).toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalledTimes(1);
    });

    it('Calls clearOldSessions automatically', async () => {
      vi.useFakeTimers();

      const spy = spyOnDb('none');
      const sessionClearInterval = 1000;
      const adapter = PostgresAdapter(db, { clearInterval: sessionClearInterval });
      const sessionSpy = vi.spyOn(adapter, 'clearOldSessions');

      vi.advanceTimersByTime(sessionClearInterval + 10);
      clearInterval(adapter.clearInterval!);
      vi.runAllTimers();
      // postgres.js does not like fake timers
      vi.useRealTimers();

      expect(spy).toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalledTimes(1);
    });
  });
});
