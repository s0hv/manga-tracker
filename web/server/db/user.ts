import { LRUCache } from 'lru-cache';

import type { OAuthProvider } from '@/common/auth/providers';
import { type DbHelpers, db } from '@/db/helpers';
import { createSingleton } from '@/serverUtils/utilities';
import type { User } from '@/types/db/user';

const userCache = createSingleton('userCache', () => new LRUCache<number, User>({
  max: 50,
  ttl: 7200000, // 2 h in ms
  noDisposeOnSet: true,
  updateAgeOnGet: true,
}));

type GetUser = {
  (userId: number, options: { expectExists: true, noCache?: boolean, conn?: DbHelpers }): Promise<User>
  (userId: number, options?: { expectExists?: false, noCache?: boolean, conn?: DbHelpers }): Promise<User | null>
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
    : conn.oneOrNone;

  return method<User>`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.user_uuid,
        u.admin,
        u.theme,
        (u.pwhash IS NOT NULL) AS is_credentials_account
      FROM users u 
      WHERE user_id=${userId}`
    .then(user => {
      if (user) {
        userCache.set(userId, user);
      }

      return user;
    });
}) as GetUser;


export const getUserByProviderAccountId = async (provider: OAuthProvider, providerAccountId: string) => {
  const user = await db.oneOrNone<Pick<User, 'userId'>>`
    SELECT user_id 
    FROM account
    WHERE provider=${provider} AND provider_account_id=${providerAccountId}`;

  if (!user) return null;

  return getUser(user.userId, { expectExists: true });
};


export const createOAuthUser = async ({
  username,
  email,
  provider,
  accountId,
}: {
  username: string
  email: string
  provider: OAuthProvider
  accountId: string
}) => {
  return db.transaction(async tran => {
    const user = await createUser({ username, email, password: null, conn: tran });

    await tran.none`INSERT INTO account ${tran.sql({ provider, accountId, userId: user.userId })}`;

    return user;
  });
};


export const createUser = async ({
  username,
  email,
  password,
  conn = db,
}: {
  username: string
  email: string
  password: string | null
  conn?: DbHelpers
}) => {
  const { userId } = await conn.one<{
    userId: number
  }>`INSERT INTO users (username, email, pwhash) VALUES (${username}, ${email}, crypt(${password}, gen_salt('bf'))) RETURNING user_id`;

  return getUser(userId, { expectExists: true, conn });
};

export const removeUserFromCache = (userId: number) => userCache.delete(userId);

export function clearUserCache() {
  userCache.clear();
}
