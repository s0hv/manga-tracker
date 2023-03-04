import type {
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';
import type { AdapterUser } from 'next-auth/adapters';

import { db } from './helpers';

export const userSelect = db.sql`
  u.user_uuid as id,
  u.email,
  u.email_verified,
  u.username as name,
  u.username,
  u.user_uuid as uuid,
  u.user_id,
  u.theme,
  u.admin,
  u.is_credentials_account
`;

export const authenticate = async (email: string, password: string) => {
  if (password.length > 72) return null;

  return db.oneOrNone<AdapterUser>`
    SELECT ${userSelect}
    FROM users u
    WHERE email=${email} AND pwhash IS NOT NULL AND pwhash=crypt(${password}, pwhash)`;
};

export const getSessionAndUser = (req: Request, res: Response, next: NextFunction) => {
  req.session = {};
  const sessCookie = 'next-auth.session-token';

  if (!req.cookies[sessCookie] || req.originalUrl.startsWith('/_next/static/')) return next();

  const wrapper = async () => req.sessionStore.getSessionAndUser(req.cookies[sessCookie]);

  wrapper().then(async sessAndUser => {
    if (!sessAndUser) return next();

    if (sessAndUser.session.expires < new Date(Date.now())) {
      await req.sessionStore.deleteSession(sessAndUser.session.sessionToken);
      return next();
    }

    req.session = sessAndUser.session;
    req.user = sessAndUser.user;
    next();
  })
    .catch(next);
};
