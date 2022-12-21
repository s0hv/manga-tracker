import { unsignCookie } from './utils';

import { db } from '../db/helpers';

export const sessionExists = async (sessionId, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId);
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.oneOrNone`SELECT 1 FROM sessions WHERE session_id=${sessionId}`;
  return !!row;
};

export const authTokenExists = async (tokenValue) => {
  tokenValue = decodeURIComponent(tokenValue);
  const [lookup, token, uuidBase64] = tokenValue.split(';', 3);
  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  const row = await db.oneOrNone`SELECT 1
               FROM auth_tokens INNER JOIN users u ON auth_tokens.user_id = u.user_id 
               WHERE user_uuid=${uuid} AND lookup=${lookup} AND hashed_token=encode(digest(${token}, 'sha256'), 'hex')`;

  return !!row;
};

export const spyOnDb = (method = 'sql') => {
  const sql = db.sql;
  const spy = jest.spyOn(db, method);

  const ignore = new Set(['caller', 'callee', 'arguments']);
  Object.getOwnPropertyNames(sql).forEach(prop => {
    if (Object.hasOwn(db.sql, prop) || ignore.has(prop)) return;
    db.sql[prop] = sql[prop];
  });

  return spy;
};

export const expectOnlySessionInsert = (spy) => {
  spy.mock.calls.forEach(call => {
    expect(call[0].join(' ')).toMatch(/^\w*INSERT INTO sessions .+/i);
  });
};

export const sessionAssociatedWithUser = async (sessionId, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId);
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.oneOrNone`SELECT user_id FROM sessions WHERE session_id=${sessionId}`;
  return row !== null && row.userId !== null;
};

export const authTokenCount = async (uuid) => {
  const row = await db.one`SELECT COUNT(*)
               FROM auth_tokens INNER JOIN users u ON auth_tokens.user_id = u.user_id
               WHERE user_uuid=${uuid}`;

  return Number(row.count);
};

export const userSessionCount = async (uuid) => {
  const row = await db.one`SELECT COUNT(*)
               FROM sessions INNER JOIN users u ON sessions.user_id = u.user_id
               WHERE user_uuid=${uuid}`;

  return Number(row.count);
};

export const createManga = async () => {
  return db.one`INSERT INTO manga (title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (${'test'}, NULL, NULL, NULL, NULL) RETURNING manga_id`
    .then(row => row.mangaId);
};

export const createMangaService = async (serviceId, customMangaId) => {
  const id = Date.now().toString();
  return (customMangaId ? Promise.resolve(customMangaId) : createManga())
    .then(mangaId => db.one`INSERT INTO manga_service (manga_id, service_id, last_check, title_id, next_update, latest_chapter, latest_decimal, feed_url) VALUES 
                                                           (${mangaId}, ${serviceId}, NULL, ${id}, NULL, NULL, NULL, ${id}) RETURNING manga_id`)
    .then(row => row.mangaId);
};

export const copyService = async (serviceId) => {
  const uniqueId = Date.now().toString();

  const { serviceId: newServiceId } = await db.one`INSERT INTO services (service_name, url, disabled, last_check, chapter_url_format, disabled_until, manga_url_format, scheduled_runs_disabled_until)  
    SELECT service_name, url || ${uniqueId}::TEXT, disabled, last_check, chapter_url_format, disabled_until, manga_url_format, scheduled_runs_disabled_until 
    FROM services WHERE service_id=${serviceId}
    RETURNING service_id`;

  await db.none`INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id) 
    SELECT ${newServiceId}, feed_url || ${newServiceId}::TEXT, last_check, next_update, last_id FROM service_whole WHERE service_id=${serviceId}`;

  await db.none`INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval) 
    SELECT ${newServiceId}, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval FROM service_config WHERE service_id=${serviceId}`;

  return newServiceId;
};
