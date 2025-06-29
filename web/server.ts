import cookieParser from 'cookie-parser';
import express, { type NextFunction } from 'express';
import helmet from 'helmet';
import next_ from 'next';
import pinoHttp from 'pino-http';

import { getSessionAndUser } from '@/db/auth';
import { db } from '@/db/helpers';
import { getSingletonPostgresAdapter } from '@/db/postgres-adapter';
import { csrfMissing, isDev, isTest } from '@/serverUtils/constants';
import { expressLogger } from '@/serverUtils/logging';
import { rateLimiter } from '@/serverUtils/ratelimits';


import {
  adminMangaApi,
  adminServicesApi,
  chapterApi,
  mangaApi,
  notificationsApi,
  rssApi,
  searchApi,
  servicesApi,
  settingsApi,
  userApi,
} from './server/api/index.js';

// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !!process.env.TRUST_PROXY;
const isCypress = /y|yes|true/.test(process.env.CYPRESS || '');

const nextApp = next_({ dev: isDev });
const handle = nextApp.getRequestHandler();

export default nextApp.prepare()
  .then(async () => {
    const server = express();

    const directives: any = {
      imgSrc: "'self' https://uploads.mangadex.org https://authjs.dev data:", // data: used by redoc
      workerSrc: "'self' blob:", // blob: used by redoc
      formAction: "'self' https://discord.com",
    };
    if (isDev) {
      // unsafe-eval required for fast refresh
      directives.scriptSrc = "'self' 'unsafe-eval' 'sha256-bNSwnlUSaw2xmSzuYfrGARS7W41eM5ASRo8PpkcVmCs='";
    } else {
      // sha is for script injected by getInitColorSchemeScript inside _document.tsx
      directives.scriptSrc = "'self' 'sha256-bNSwnlUSaw2xmSzuYfrGARS7W41eM5ASRo8PpkcVmCs='";
    }

    server.use(helmet({
      contentSecurityPolicy: {
        directives,
        useDefaults: true,
      },
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: !isDev && !isCypress,
      referrerPolicy: {
        policy: 'strict-origin',
      },
    }));
    if (reverseProxy) server.set('trust proxy', process.env.TRUST_PROXY);

    server.sessionStore = getSingletonPostgresAdapter(db, {
      clearInterval: isTest ? null : 7.2e+6, // 2 hours
    });
    server.use((req, res, next) => {
      req.sessionStore = server.sessionStore;
      next();
    });

    server.use(pinoHttp({ logger: expressLogger, useLevel: 'debug' }));

    server.use(express.json());
    server.use(express.urlencoded({ extended: false }));

    server.use(cookieParser(undefined));
    server.use(getSessionAndUser);

    /* server.use(session({
      name: 'sess',
      cookie: {
        maxAge: 7200000,
        sameSite: 'lax',
        httpOnly: true,
        secure: !isDev,
      },
      proxy: reverseProxy,
      secret: isDev ? 'secret' : process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,

      store: store,
    })); */

    // cookie: true is vulnerable and should not be used
    server.use((req, res, next) => {
      if (req.originalUrl.startsWith('/api/auth/') || req.originalUrl.startsWith('/_next/static/')) return next();

      // https://lucia-auth.com/sessions/cookies/#csrf-protection
      if (req.method !== 'GET') {
        const origin = req.header('Origin');
        // You can also compare it against the Host or X-Forwarded-Host header.
        if (origin === null || origin !== process.env.BASE_URL) {
          res.status(403).json({
            error: csrfMissing,
          });
          return;
        }
      }

      next();
    });

    if (!isTest && !isCypress) {
      server.use((req, res, next) => {
        // No need to ratelimit static resources
        if (req.originalUrl.startsWith('/_next/static/')) return next();

        rateLimiter(req, res, next);
      });
    }

    server.use((req, res, next) => {
      // No need to log access to static resources
      if (req.originalUrl.startsWith('/_next/static/')) return next();

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
    /* istanbul ignore next */
    if (isCypress && (global as any).__coverage__) {
      server.get('/__coverage__', (req, res) => {
        res.json({
          coverage: (global as any).__coverage__ || null,
        });
      });
    }

    server.get('/login', (req, res) => {
      if (req.session.userId) {
        res.redirect('/');
        return;
      }
      return handle(req, res);
    });

    server.post('/api/authCheck', (req, res) => {
      if (!req.user) {
        res.status(401).end();
        return;
      }
      res.json({ user: {
        uuid: req.user.uuid,
        username: req.user.username,
      }});
    });

    server.get('/manga/:mangaId(\\d+)', (req, res) => handle(req, res));

    // next auth
    server.all('/api/auth/*', (req, res) => handle(req, res));

    server.get('*', (req, res) => handle(req, res));

    // Error handlers
    server.use((err: any, req: express.Request, res: express.Response, next: NextFunction) => {
      // Handle CSRF errors
      if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({
          error: csrfMissing,
        });
        return;
      }

      req.log.error(err);

      next(err);
    });

    const port = process.env.PORT || 3000;

    return server.listen(port, () => {
      console.log('Listening on port', port);
    });
  })
  .catch(console.error);
