import type { Response } from 'express-serve-static-core';

import {
  isSecure,
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '@/serverUtils/constants';
import type { SessionWithToken } from '@/types/session';

export const setSessionCookie = (session: Pick<SessionWithToken, 'token' | 'expiresAt'>, res: Response) => {
  res.cookie(serverCookieNames.session, session.token, {
    ...SECURE_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
};

export function clearSecureCookie(res: Response, cookieName: string) {
  res.clearCookie(cookieName, {
    secure: isSecure,
  });
}
