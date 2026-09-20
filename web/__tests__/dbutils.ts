import { addHours } from 'date-fns';
import request from 'supertest';
import { type Mock, expect, vi } from 'vitest';
import * as z from 'zod';

import { getAuthTokenCookie, getCookie, unsignCookie } from './utils';
import { insertValues } from '@/db/utils';
import { parseAuthCookie } from '@/db/auth';
import { db, queryLoggingInterceptor, sql, voidSql } from '@/db/index';
import { serverCookieNames } from '@/serverUtils/constants';
import { hashSecret } from '@/serverUtils/utilities';
import { ChapterFailSchema, generateSchema } from '@/tests/schemas';
import type { ChapterFail } from '@/types/db/chapterFail';
import type { DatabaseId } from '@/types/dbTypes';
import type { Session } from '@/types/session';

const zCount = z.object({ count: z.int() });
const zUserId = z.object({ userId: z.int().nullable() });
const zMangaId = z.object({ mangaId: z.int() });
const zServiceId = z.object({ serviceId: z.int() });


export const sessionExists = async (sessionId: string, encrypted = true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId);
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.exists(sql.unsafe`SELECT 1 FROM sessions WHERE session_id=${sessionId}`);
  return row;
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

  await db.query(voidSql`INSERT INTO sessions ${insertValues({
    ...sessionData,
    sessionSecret: sql.binary(Buffer.from(sessionData.sessionSecret)),
  })}`);

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

  return db.exists(sql.unsafe`SELECT 1
               FROM auth_token
                 INNER JOIN users u ON auth_token.user_id = u.user_id
               WHERE u.user_uuid=${authTokenCookie.userUUID} AND lookup=${authTokenCookie.lookup} AND token_hash=${sql.binary(Buffer.from(tokenHash))}`);
};

export const authTokenCount = async (uuid: string) => {
  return db.oneFirst(sql.type(zCount)`SELECT COUNT(*) as count
               FROM auth_token INNER JOIN users u ON auth_token.user_id = u.user_id
               WHERE user_uuid=${uuid}`);
};

export type SqlMock = Mock<NonNullable<typeof queryLoggingInterceptor.beforeQueryExecution>>;
export type SqlHelperMock = Mock<(...args: any[]) => Promise<any>>;

type OnlyCallable<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

export function spyOnDb(method?: null): SqlMock;
export function spyOnDb(method: keyof OnlyCallable<typeof db>): SqlHelperMock;
export function spyOnDb(method: keyof OnlyCallable<typeof db> | null = null): SqlHelperMock | SqlMock {
  const spy = method === null
    ? vi.spyOn(queryLoggingInterceptor, 'beforeQueryExecution')
    : vi.spyOn(db, method) as SqlHelperMock;

  // In case another test mocked this method, clear the spy before returning it
  spy.mockClear();

  return spy;
}

export const expectOnlySessionInsert = (spy: SqlMock) => {
  spy.mock.calls.forEach(call => {
    expect(call[1].sql).toMatch(/^\w*INSERT INTO sessions .+/i);
  });
};

export const sessionAssociatedWithUser = async (sessionId: string, encrypted = false) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId); // Type safety asserted on the next line
  }
  expect(sessionId).not.toBeFalse();

  const row = await db.maybeOne(sql.type(zUserId)`SELECT user_id FROM sessions WHERE session_id=${sessionId}`);
  return row !== null && row.userId !== null;
};

export const userSessionCount = async (uuid: string) => {
  return db.oneFirst(sql.type(zCount)`SELECT COUNT(*) as count
               FROM sessions INNER JOIN users u ON sessions.user_id = u.user_id
               WHERE user_uuid=${uuid}`);
};

export const createManga = async (): Promise<number> => {
  return db.oneFirst(sql.type(zMangaId)`INSERT INTO manga (title, release_interval, latest_release, estimated_release, latest_chapter)
    VALUES (${'test'}, NULL, NULL, NULL, NULL)
    RETURNING manga_id`);
};

export const createMangaService = async (serviceId: DatabaseId, customMangaId?: DatabaseId) => {
  const id = Date.now().toString();
  const mangaId = await (customMangaId
    ? Promise.resolve(customMangaId)
    : createManga());

  return db.oneFirst(sql.type(zMangaId)`INSERT INTO manga_service (manga_id, service_id, last_check, title_id, next_update, latest_chapter, latest_decimal, feed_url) VALUES
                                                           (${mangaId}, ${serviceId}, NULL, ${id}, NULL, NULL, NULL, ${id}) RETURNING manga_id`);
};

export const copyService = async (serviceId: DatabaseId) => {
  const uniqueId = Date.now().toString();

  const newServiceId = await db.oneFirst(sql.type(zServiceId)`INSERT INTO services (service_name, url, disabled, last_check, chapter_url_format, disabled_until, manga_url_format, scheduled_runs_disabled_until)
    SELECT service_name, url || ${uniqueId}::TEXT, disabled, last_check, chapter_url_format, disabled_until, manga_url_format, scheduled_runs_disabled_until
    FROM services WHERE service_id=${serviceId}
    RETURNING service_id`);

  await db.query(voidSql`INSERT INTO service_whole (service_id, feed_url, last_check, next_update, last_id)
    SELECT ${newServiceId}, feed_url || ${newServiceId}::TEXT, last_check, next_update, last_id FROM service_whole WHERE service_id=${serviceId}`);

  await db.query(voidSql`INSERT INTO service_config (service_id, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval)
    SELECT ${newServiceId}, check_interval, scheduled_run_limit, scheduled_runs_enabled, scheduled_run_interval FROM service_config WHERE service_id=${serviceId}`);

  return newServiceId;
};

export const createChapterFail = async (chapterFail?: Omit<ChapterFail, 'timestamp'>) => {
  const data = chapterFail ?? generateSchema(ChapterFailSchema);

  await db.query(voidSql`
      INSERT INTO chapters_failed ${insertValues(data)}`);

  return {
    serviceId: data.serviceId,
    chapterIdentifier: data.chapterIdentifier,
  };
};

export const deleteChapterFail = async (
  serviceId: number,
  chapterIdentifier: string
) => {
  await db.query(voidSql`
      DELETE FROM chapters_failed
      WHERE service_id = ${serviceId}
      AND chapter_identifier = ${chapterIdentifier}`);
};

export const chapterFailExists = async (serviceId: number, chapterIdentifier: string) => {
  return db.exists(sql.unsafe`
        SELECT 1
        FROM chapters_failed
        WHERE service_id = ${serviceId}
          AND chapter_identifier = ${chapterIdentifier}`);
};
