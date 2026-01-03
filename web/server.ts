import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookieParser from 'cookie-parser';
import { hoursToMilliseconds, secondsToMilliseconds } from 'date-fns';
import express, { type NextFunction } from 'express';
import type { Request, Response } from 'express-serve-static-core';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { type AdapterMeta, toNodeHandler } from 'srvx/node';

import {
  adminMangaApi,
  adminServicesApi,
  authHandler,
  chapterApi,
  mangaApi,
  notificationsApi,
  rssApi,
  searchApi,
  servicesApi,
  settingsApi,
  userApi,
} from '#server/api/index';
import registerThumbnails from '#server/api/thumbnails';
import { useSessionAndUser } from '#server/db/auth';
import {
  setSessionClearInterval,
  touchSessionOnRequest,
  updateSession,
} from '#server/db/session';
import tanstackProdHandler from '#server/distServerStub';
import { tanstackIntegration } from '#server/tanstackIntegration';
import {
  csrfMissing,
  HOST_URL,
  IS_DEVELOPMENT,
  IS_PROD,
  isTest,
  SECURE_COOKIE_OPTIONS,
  serverCookieNames,
} from '#server/utils/constants';
import { validateEnv } from '#server/utils/environment';
import { StatusError } from '#server/utils/errors';
import { expressLogger, sessionLogger } from '#server/utils/logging';
import { rateLimiter, redis } from '#server/utils/ratelimits';
import {
  redirectCookieOptions,
} from '#server/utils/redirect';
import {
  generateSecureRandomBytes,
  uint8ArrayToBase64,
} from '#server/utils/utilities';
import { addMangaView } from '#server/utils/view-counter';

import { COOKIES } from './common/cookies';


validateEnv();

// Initialize the redis connection
void redis.connect();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirname = __dirname;

// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !!process.env.TRUST_PROXY;
const isCypress = /y|yes|true/.test(process.env.CYPRESS || '');

const server = express();

if (reverseProxy) {
  server.set('trust proxy', process.env.TRUST_PROXY);
}

setSessionClearInterval(hoursToMilliseconds(2));

type CSPDirective = string | ((req: Request, res: Response) => string);

const nonceCsp = (req: Request) => {
  if (req.isStaticResource) return '';
  if (req.originalUrl.startsWith('/api')) return '';

  return `'nonce-${req.getNonce()}'`;
};

const directives: Record<string, CSPDirective[] | null> = {
  imgSrc: ["'self' https://mangadex.org data:"], // data: used by redoc
  workerSrc: ["'self'"],
  formAction: ["'self'", 'https://discord.com'],
  /* istanbul ignore next */
  'upgrade-insecure-requests': (IS_DEVELOPMENT || isCypress || process.env.ENVIRONMENT === 'development') ? null : [],
  /* istanbul ignore next */
  scriptSrc: isCypress
    // Cypress testing requires more lenient rules
    ? ["'self' 'unsafe-inline' 'unsafe-eval'"]
    : ["'self'", nonceCsp],
};


/* istanbul ignore if */
if (IS_DEVELOPMENT) {
  directives.connectSrc = ["'self'", 'ws:'];
}

server.use(pinoHttp({ logger: expressLogger, useLevel: 'debug' }));

server.use((req, _, next) => {
  req.getNonce = () => {
    if (req._nonce) return req._nonce;

    req._nonce = uint8ArrayToBase64(generateSecureRandomBytes(15));
    return req._nonce;
  };

  next();
});

/* istanbul ignore if */
if (IS_DEVELOPMENT) {
  server.use((req, _, next) => {
    req.isStaticResource = req.originalUrl.startsWith('/node_modules') || /\.[jt]sx?$/.test(req.originalUrl);

    next();
  });
} else {
  server.use((req, _, next) => {
    req.isStaticResource = req.originalUrl.startsWith('/assets/');

    next();
  });
}

server.use(helmet({
  contentSecurityPolicy: {
    directives: directives as Record<string, string[]>,
    useDefaults: true,
  },
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: IS_PROD && !isCypress,
  referrerPolicy: {
    policy: 'same-origin',
  },
}));

server.use((req, res, next) => {
  // No need to log access to static resources
  if (req.isStaticResource) {
    return next();
  }

  res.on('finish', () => {
    expressLogger.info('%s %s %s %s  User Agent: %s',
      res.statusCode,
      req.method,
      req.ip,
      req.originalUrl,
      req.headers['user-agent']);
  });

  next();
});

/* istanbul ignore else */
if (!IS_DEVELOPMENT) {
  server.use(express.static(path.join(dirname, 'client')));
} else {
  server.use(express.static(path.join(dirname, 'public')));
}

// No need to parse anything extra before we get here
registerThumbnails(server);

// CSRF checks
server.use((req, res, next) => {
  // https://lucia-auth.com/sessions/cookies/#csrf-protection
  // Cypress does not always send the Origin header, so we skip CSRF checks in that case
  if (req.method !== 'GET' && !isCypress) {
    const origin = req.header('Origin');
    // You can also compare it against the Host or X-Forwarded-Host header.
    if (origin === null || origin !== HOST_URL.origin) {
      res.status(403).json({
        error: csrfMissing,
      });
      return;
    }
  }

  next();
});

server.use(express.json());
server.use(express.urlencoded({ extended: false }));

server.use(cookieParser(process.env.COOKIE_SECRET));
server.use(useSessionAndUser);
server.use(touchSessionOnRequest);

// Remember me logic
server.use((req, res, next) => {
  // If session is already active, or if auth token does not exist, do nothing
  if (req.isStaticResource || req.session?.userId || !req.signedCookies[serverCookieNames.authToken]) {
    return next();
  }

  // No need to handle redirects on API calls
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }

  const url = new URL(req.originalUrl, process.env.HOST);

  res.cookie(COOKIES.redirect, url.pathname, redirectCookieOptions);
  res.cookie(serverCookieNames.authRestore, '1', {
    ...SECURE_COOKIE_OPTIONS,
    signed: false,
    path: '/api/auth/restore-login',
    // This should be extremely short-lived
    maxAge: secondsToMilliseconds(20),
  });
  res.redirect('/api/auth/restore-login');
});

if (!isTest && !isCypress) {
  server.use((req, res, next) => {
    // No need to ratelimit static resources
    if (req.isStaticResource) return next();

    rateLimiter(req, res, next);
  });
}

authHandler(server);
rssApi(server);
mangaApi(server);
userApi(server);
settingsApi(server);
searchApi(server);
adminServicesApi(server);
chapterApi(server);
servicesApi(server);
notificationsApi(server);
server.use('/api/admin/manga', adminMangaApi());

// https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md
/* istanbul ignore if */
if (isCypress && (global as any).__coverage__) {
  server.get('/__coverage__', (_, res) => {
    res.json({
      coverage: (global as any).__coverage__ || null,
    });
  });
}

server.get('/login', (req, res, next) => {
  if (req.session?.userId) {
    res.redirect('/');
    return;
  }

  return next();
});

server.post('/api/authCheck', (req, res) => {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  res.json({ user: {
    uuid: req.user.userUuid,
    username: req.user.username,
  }});
});

// View counter logic
server.get('/manga/:mangaId', (req, _, next) => {
  if (!req.session) {
    return next();
  }

  if (addMangaView(req.session, req.params.mangaId)) {
    void updateSession({
      sessionId: req.session.sessionId,
      data: req.session.data,
    })
      .catch((err: unknown) => sessionLogger.error('Failed to update session', err));
  }

  next();
});

/* istanbul ignore if */
if (process.env.ENVIRONMENT === 'unit-test') {
  server.get('/', (_, res) => {
    res.send('OK');
  });
/* istanbul ignore next */
} else if (IS_DEVELOPMENT) {
  void tanstackIntegration(server);
} else {
  // Create the API endpoint after we have successfully imported the tanstack server file.
  // This way we can ensure that the server boots correctly
  server.get('/api/health', (_, res) => {
    res.status(200).send('OK');
  });

  server.get('*splat', async (req, res) => {
    const wrappedHandler: AdapterMeta['__fetchHandler'] = request =>
      tanstackProdHandler.fetch(request, {
        context: {
          session: req.session,
          user: req.user,
          nonce: req.getNonce(),
        },
      });

    const handler = toNodeHandler(wrappedHandler);
    await handler(req, res);
  });
}

// Error handlers
server.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  req.log.error(err, 'Failed to process request');

  if (err instanceof StatusError) {
    res
      .status(err.status)
      .json({ error: err.message })
      .end();
    return;
  }

  if (err instanceof RateLimiterRes) {
    res
      .status(429)
      .setHeader('X-RateLimit-Remaining', err.msBeforeNext)
      .json({
        error: {
          nextValidRequestDate: new Date(Date.now() + err.msBeforeNext),
        },
      })
      .end();
    return;
  }

  next(err);
});

const port = process.env.PORT || 3000;

export default server.listen(port, () => {
  console.log('Listening on port', port);
});
