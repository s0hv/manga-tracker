import type {
  CookieOptions,
  Request,
  Response,
} from 'express-serve-static-core';

import { COOKIES } from '@/common/cookies';
import { isSecure } from '@/serverUtils/constants';
import type { AnyRequest } from '@/types/request';


export const redirectCookieOptions: CookieOptions = {
  httpOnly: false,
  sameSite: 'lax',
  secure: isSecure,
  path: '/',
};

export const getRedirectFromHeader = (req: Request) => {
  const refererHeader = req.header('referer');

  if (!refererHeader) return;

  const referrer = new URL(refererHeader).pathname || '/';

  // No need to redirect to the API paths
  if (referrer.startsWith('/api')) return;

  return referrer;
};

export const setRedirectCookie = (req: Request, res: Response) => {
  const referrer = getRedirectFromHeader(req);

  if (!referrer) return;

  res.cookie(COOKIES.redirect, referrer, redirectCookieOptions);
};

export const clearRedirectCookie = (res: Response) => {
  res.clearCookie(COOKIES.redirect);
};

export const getRedirectUrl = (req: AnyRequest): string => {
  const redirect = req.cookies[COOKIES.redirect];

  if (!redirect) {
    return '/';
  }

  let url: URL;

  try {
    url = new URL(`http://a.b${redirect}`);
  } catch {
    return '/';
  }

  const pathname = url.pathname;

  if (pathname.startsWith('/api')) {
    return '/';
  }

  return pathname || '/';
};
