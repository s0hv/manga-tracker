import { LRUCache } from 'lru-cache';
import type { CommonQueryMethods } from 'slonik';
import * as z from 'zod';

import type { OAuthProvider } from '@/common/auth/providers';
import { createSingleton } from '@/serverUtils/utilities';

import { db, sql, voidSql } from './index';

import { UserRow } from './schemas/user';
import { insertValues } from './utils';

const userCache = createSingleton('userCache', () => new LRUCache<number, UserRow>({
  max: 50,
  ttl: 7200000, // 2 h in ms
  noDisposeOnSet: true,
  updateAgeOnGet: true,
}));

type GetUser = {
  (userId: number, options: { expectExists: true; noCache?: boolean; conn?: CommonQueryMethods }): Promise<UserRow>;
  (userId: number, options?: { expectExists?: false; noCache?: boolean; conn?: CommonQueryMethods }): Promise<UserRow | null>;
};

export const getUser: GetUser = (async (userId, options = {}) => {
  const {
    expectExists = false,
    noCache = false,
    conn = db,
  } = options;

  if (!noCache) {
    const cachedUser = userCache.get(userId);
    if (cachedUser) {
      return cachedUser;
    }
  }

  const method = expectExists
    ? conn.one
    : conn.maybeOne;

  return method(sql.type(UserRow)`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.user_uuid,
        u.admin,
        u.theme,
        (u.pwhash IS NOT NULL) AS is_credentials_account
      FROM users u
      WHERE user_id=${userId}`)
    .then(user => {
      if (user) {
        userCache.set(userId, user);
      }

      return user;
    });
}) as GetUser;


export const getUserByProviderAccountId = async (provider: OAuthProvider, providerAccountId: string) => {
  const user = await db.maybeOne(sql.type(z.object({ userId: z.int() }))`
    SELECT user_id
    FROM account
    WHERE provider=${provider} AND provider_account_id=${providerAccountId}`);

  if (!user) return null;

  return getUser(user.userId, { expectExists: true });
};


export const createOAuthUser = async ({
  username,
  email,
  provider,
  accountId,
}: {
  username: string;
  email: string;
  provider: OAuthProvider;
  accountId: string;
}) => {
  return db.transaction(async tran => {
    const user = await createUser({ username, email, password: null, conn: tran });

    await tran.query(voidSql`INSERT INTO account ${insertValues({ provider, accountId, userId: user.userId })}`);

    return user;
  });
};


export const createUser = async ({
  username,
  email,
  password,
  conn = db,
}: {
  username: string;
  email: string;
  password: string | null;
  conn?: CommonQueryMethods;
}) => {
  const { userId } = await conn.one(sql.type(z.object({ userId: z.int() }))`INSERT INTO users (username, email, pwhash) VALUES (${username}, ${email}, crypt(${password}, gen_salt('bf'))) RETURNING user_id`);

  return getUser(userId, { expectExists: true, conn });
};

export const removeUserFromCache = (userId: number) => userCache.delete(userId);

export function clearUserCache() {
  userCache.clear();
}
