import express, { type NextFunction } from 'express';
import next_ from 'next';
import csrf from 'csurf';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';

import { csrfMissing, isDev, isTest } from '@/serverUtils/constants';
import { db } from '@/db/helpers';
import { rateLimiter } from '@/serverUtils/ratelimits';
import { expressLogger } from '@/serverUtils/logging';

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
} from './api/index.js';
import { getSingletonPostgresAdapter } from '@/db/postgres-adapter';
import { getSessionAndUser } from '@/db/auth';

// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !!process.env.TRUST_PROXY;
const isCypress = /y|yes|true/.test(process.env.CYPRESS || '');

const nextApp = next_({ dev: isDev });
const handle = nextApp.getRequestHandler();

export default nextApp.prepare()
  .then(() => {
    const server = express();

    const directives: any = {
      imgSrc: "'self' https://uploads.mangadex.org https://authjs.dev data:", // data: used by redoc
      workerSrc: "'self' blob:", // blob: used by redoc
      formAction: "'self' https://discord.com",
    };
    if (isDev) {
      // unsafe-eval required for fast refresh
      directives.scriptSrc = "'self' 'unsafe-eval' 'sha256-6k13i7If3TvAai1sXmN5y2hfMfidi1GAP6UXk1irAMM='";
    } else {
      // sha is for script injected by getInitColorSchemeScript inside _document.tsx
      directives.scriptSrc = "'self' 'sha256-6k13i7If3TvAai1sXmN5y2hfMfidi1GAP6UXk1irAMM='";
    }

    server.use(helmet({
      contentSecurityPolicy: {
        directives,
        useDefaults: true,
      },
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: !isDev && !isCypress,
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
    const csrfMiddleware = csrf({ cookie: false });
    server.use((req, res, next) => {
      if (req.originalUrl.startsWith('/api/auth/') || req.originalUrl.startsWith('/_next/static/')) return next();

      // CSRF won't work for non-logged-in users as sessions are only created when
      // logging in. This shouldn't be a problem since all methods that require
      // CSRF protection also require signing in (except for next auth paths).
      csrfMiddleware(req, res, next);
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
