import { expect, type Mock, vi } from 'vitest';
import { unsignCookie } from './utils';

import { type DatabaseHelpers, db } from '@/db/helpers';
import type { DatabaseId } from '@/types/dbTypes';

export const sessionExists = async (sessionId: string, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId) as string;
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.oneOrNone`SELECT 1 FROM sessions WHERE session_id=${sessionId}`;
  return !!row;
};

export const authTokenExists = async (tokenValue: string) => {
  tokenValue = decodeURIComponent(tokenValue);
  const [lookup, token, uuidBase64] = tokenValue.split(';', 3);
  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  const row = await db.oneOrNone`SELECT 1
               FROM auth_tokens INNER JOIN users u ON auth_tokens.user_id = u.user_id 
               WHERE user_uuid=${uuid} AND lookup=${lookup} AND hashed_token=encode(digest(${token}, 'sha256'), 'hex')`;

  return !!row;
};


export type SqlMock = Mock<(count: number, query: string) => void>
export type SqlHelperMock = Mock<(template: TemplateStringsArray, ...rest: any[]) => Promise<any>>
export const spyOnDb = (method: keyof DatabaseHelpers | null = null): SqlHelperMock | SqlMock => {
  if (method === null) {
    const spy: SqlMock = vi.fn();
    db.sql.options.debug = spy;
    return spy;
  }

  return vi.spyOn(db, method) as SqlHelperMock;
};

export const filterTypeSelect = (spy: SqlMock) => spy.mock.calls.filter(c => !/select\s+b.oid,\s+b.typarray\s+from\s+pg_catalog.pg_type\s+a/im.test(c[1].trim()));

export const expectOnlySessionInsert = (spy: SqlMock) => {
  (filterTypeSelect(spy)).forEach(call => {
    expect(call[1]).toMatch(/^\w*INSERT INTO sessions .+/i);
  });
};

export const sessionAssociatedWithUser = async (sessionId: string, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId) as string; // Type safety asserted on the next line
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.oneOrNone`SELECT user_id FROM sessions WHERE session_id=${sessionId}`;
  return row !== null && row.userId !== null;
};

export const userSessionCount = async (uuid: string) => {
  const row = await db.one`SELECT COUNT(*)
               FROM sessions INNER JOIN users u ON sessions.user_id = u.user_id
               WHERE user_uuid=${uuid}`;

  return Number(row.count);
};

export const createManga = async (): Promise<number> => {
  return db.one`INSERT INTO manga (title, release_interval, latest_release, estimated_release, latest_chapter) VALUES (${'test'}, NULL, NULL, NULL, NULL) RETURNING manga_id`
    .then(row => row.mangaId);
};

export const createMangaService = async (serviceId: DatabaseId, customMangaId?: DatabaseId) => {
  const id = Date.now().toString();
  return (customMangaId ? Promise.resolve(customMangaId) : createManga())
    .then(mangaId => db.one`INSERT INTO manga_service (manga_id, service_id, last_check, title_id, next_update, latest_chapter, latest_decimal, feed_url) VALUES 
                                                           (${mangaId}, ${serviceId}, NULL, ${id}, NULL, NULL, NULL, ${id}) RETURNING manga_id`)
    .then(row => row.mangaId);
};

export const copyService = async (serviceId: DatabaseId) => {
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
