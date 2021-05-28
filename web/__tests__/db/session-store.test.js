import sessionStore from '../../db/session-store';
import { db, pgp } from '../../db';
import { spyOnDb } from '../dbutils';


afterAll(async () => {
  await pgp.end();
});

describe('sessionStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const Store = sessionStore(require('express-session'));
  it('Throws error when connection not given to constructor', () => {
    expect(() => new Store()).toThrow(/no postgres connection given/i);
  });

  it('Constructs class with default values', () => {
    expect(() => new Store({ conn: db })).not.toThrow();
  });

  it('Uses options given to the constructor', () => {
    const cacheSize = 10;
    const maxAge = 50000;
    const store = new Store({
      conn: db,
      cacheSize,
      maxAge,
    });

    expect(store.cache.maxAge).toStrictEqual(maxAge);
    expect(store.cache.max).toStrictEqual(cacheSize);
  });

  describe('Getting sessions', () => {
    it('Returns nothing when session not found', () => {
      expect.assertions(1);
      const store = new Store({ conn: db });
      return expect(new Promise(resolve => store.get('no sid', (...args) => resolve(args))))
        .resolves
        .toEqual([null, null]);
    });

    it('Returns session when found from database and saves it to cache', async () => {
      const spy = spyOnDb();
      const store = new Store({ conn: db });
      const sid = 'sid_get';
      const session = { test: 1, data: 'data' };

      // Delete existing session and add new one
      await db.query('DELETE FROM sessions WHERE session_id=$1', [sid]);
      const sql = 'INSERT INTO sessions (user_id, session_id, expires_at, data) VALUES ($1, $2, $3, $4)';
      await db.query(sql, [null, sid, new Date(Date.now() + 60*60*60), session]);

      const expected = { ...session, userId: null };
      await expect(new Promise(resolve => store.get(sid, (...args) => resolve(args))))
        .resolves
        .toEqual([null, expected]);

      expect(spy).toHaveBeenCalledTimes(3);

      // Make sure found session was cached
      expect(store.cache.get(sid)).toEqual(expected);
    });

    it('Returns session without database calls when it is in cache', async () => {
      const spy = spyOnDb();
      const store = new Store({ conn: db });
      const sid = 'sid_get_cache';
      const session = { test: 1, data: 'data' };

      store.cache.set(sid, session, 60*60*60);

      await expect(new Promise(resolve => store.get(sid, (...args) => resolve(args))))
        .resolves
        .toEqual([null, { ...session }]);

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('Returns error on database errors', async () => {
      const error = new Error('test');
      const spy = spyOnDb().mockImplementation(async () => throw error);
      const store = new Store({ conn: db });
      const sid = 'sid_get_error';

      await expect(new Promise(resolve => store.get(sid, (...args) => resolve(args))))
        .resolves
        .toEqual([error, null]);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Setting sessions', () => {
    const session = {
      test: 1,
      data: 'data',
      cookie: { _expires: new Date(Date.now() + 60*60*60),
      }};

    it('Saves new session to database and cache', async () => {
      const spy = spyOnDb();
      const store = new Store({ conn: db });
      const sid = 'sid_set';

      await expect(new Promise(resolve => store.set(sid, session, resolve)))
        .resolves
        .toBeNull();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(store.cache.get(sid)).toEqual(session);
    });

    it('Returns error on database errors while still setting cache', async () => {
      const error = new Error('test');
      const spy = spyOnDb().mockImplementation(async () => throw error);
      const store = new Store({ conn: db });
      const sid = 'sid_set_error';

      await expect(new Promise(resolve => store.set(sid, session, resolve)))
        .resolves
        .toEqual(error);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(store.cache.get(sid)).toEqual(session);
    });
  });

  describe('clearOldSessions and manga views', () => {
    it('mergeSessionViews merges sessions correctly', (done) => {
      jest.useFakeTimers();

      const createData = (mangaId, views) => ({ data: { mangaViews: { [mangaId]: views }}});
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

      const expected = {
        mangaViews: {
          1: 4,
          2: 6,
          3: 1,
        },
      };

      const mangaViews = require('../../utils/view-counter/manga-view-counter');

      const dbSpy = spyOnDb().mockImplementation(async () => rows);
      const sessionClearInterval = 1000;
      const store = new Store({ conn: db, clearInterval: sessionClearInterval });
      const sessionSpy = jest.spyOn(store, 'clearOldSessions');

      // This must be wrapped with done since otherwise the callback is not used in evaluation
      jest.spyOn(mangaViews, 'onSessionExpire')
        .mockImplementation((sess) => {
          clearInterval(store.clearInterval);
          try {
            expect(sess).toEqual(expected);
            expect(dbSpy).toHaveBeenCalled();
            expect(sessionSpy).toHaveBeenCalledTimes(1);
            done();
          } catch (err) {
            done(err);
          }
          jest.runAllTimers();
        });

      jest.advanceTimersByTime(sessionClearInterval+1);
    });

    it('Calls clearOldSessions automatically', async () => {
      jest.useFakeTimers();

      const spy = spyOnDb();
      const sessionClearInterval = 1000;
      const store = new Store({ conn: db, clearInterval: sessionClearInterval });
      const sessionSpy = jest.spyOn(store, 'clearOldSessions');

      jest.advanceTimersByTime(sessionClearInterval+1);
      clearInterval(store.clearInterval);
      expect(spy).toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalledTimes(1);
      jest.runAllTimers();
    });
  });
});
