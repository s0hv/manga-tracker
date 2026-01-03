import { addHours } from 'date-fns';
import request from 'supertest';
import { type Mock, expect, vi } from 'vitest';

import { getAuthTokenCookie, getCookie, unsignCookie } from './utils';
import { parseAuthCookie } from '@/db/auth';
import { type DatabaseHelpers, db } from '@/db/helpers';
import { serverCookieNames } from '@/serverUtils/constants';
import { hashSecret } from '@/serverUtils/utilities';
import type { DatabaseId } from '@/types/dbTypes';
import type { Session } from '@/types/session';


export const sessionExists = async (sessionId: string, encrypted = true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId) as string;
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.oneOrNone`SELECT 1 FROM sessions WHERE session_id=${sessionId}`;
  return !!row;
};

export const createTestSession = async (sessionId: string, userId: number | null = null) => {
  const sessionSecret = 'testSessionSecret';

  const token = sessionId + '.' + Buffer.from(sessionSecret).toString('base64');
  const expiresAt = addHours(new Date(), 24);

  const sessionData: Session = {
    userId,
    sessionId,
    expiresAt,
    data: null,
    sessionSecret: await hashSecret(sessionSecret),
  } as const;

  await db.none`INSERT INTO sessions ${db.sql(sessionData)}`;

  return { token, expiresAt, sessionId };
};

export async function expectSessionRegenerated(agent: request.Agent, oldSess: string) {
  const sess = getCookie(agent, serverCookieNames.session)!;
  expect(sess).toBeDefined();
  expect(sess.value).not.toEqual(oldSess);

  expect(await sessionExists(oldSess)).toBeFalse();
  return sess;
}

export async function expectAuthTokenRegenerated(agent: request.Agent, authCookie: string) {
  const auth = getAuthTokenCookie(agent);
  expect(auth.value).not.toEqual(authCookie);

  expect(await authTokenExists(authCookie)).toBeFalse();
  return auth;
}

export const authTokenExists = async (authCookie: string) => {
  const authTokenCookie = parseAuthCookie(authCookie)!;
  expect(authTokenCookie).toBeDefined();

  const tokenHash = await hashSecret(authTokenCookie.token);

  const row = await db.oneOrNone`SELECT 1
               FROM auth_token 
                 INNER JOIN users u ON auth_token.user_id = u.user_id
               WHERE u.user_uuid=${authTokenCookie.userUUID} AND lookup=${authTokenCookie.lookup} AND token_hash=${tokenHash}`;

  return !!row;
};

export const authTokenCount = async (uuid: string) => {
  const row = await db.one`SELECT COUNT(*)
               FROM auth_token INNER JOIN users u ON auth_token.user_id = u.user_id
               WHERE user_uuid=${uuid}`;

  return Number(row.count);
};

export type SqlMock = Mock<(count: number, query: string) => void>;
export type SqlHelperMock = Mock<(template: TemplateStringsArray, ...rest: any[]) => Promise<any>>;

export function spyOnDb(method?: null): SqlMock;
export function spyOnDb(method: keyof DatabaseHelpers): SqlHelperMock;
export function spyOnDb(method: keyof DatabaseHelpers | null = null): SqlHelperMock | SqlMock {
  if (method === null) {
    const spy: SqlMock = vi.fn();
    db.sql.options.debug = spy;
    return spy;
  }

  const spy = vi.spyOn(db, method) as SqlHelperMock;
  // In case another test mocked this method, clear the spy before returning it
  spy.mockClear();

  return spy;
}


export const filterTypeSelect = (spy: SqlMock) => spy.mock.calls.filter(c => !/select\s+b.oid,\s+b.typarray\s+from\s+pg_catalog.pg_type\s+a/im.test(c[1].trim()));

export const expectOnlySessionInsert = (spy: SqlMock) => {
  (filterTypeSelect(spy)).forEach(call => {
    expect(call[1]).toMatch(/^\w*INSERT INTO sessions .+/i);
  });
};

export const sessionAssociatedWithUser = async (sessionId: string, encrypted = false) => {
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
