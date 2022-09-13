import express, { NextFunction } from 'express';
import type { Express } from 'express-serve-static-core';
import next_ from 'next';
import csrf from 'csurf';
import session from 'express-session';
import passport from 'passport';
import JsonStrategy from 'passport-json';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';

import { csrfMissing, isDev, isTest } from './utils/constants.js';
import { db } from './db/helpers';
import PostgresStore from './db/session-store';
import {
  authenticate,
  checkAuth,
  createRememberMeToken,
  requiresUser,
  setUserOnLogin,
} from './db/auth';
import { bruteforce, rateLimiter } from './utils/ratelimits.js';
import { expressLogger, logger, sessionLogger } from './utils/logging.js';

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
import type { User } from '@/types/db/user';

passport.use(
  new JsonStrategy(
    {
      usernameProp: 'email',
      passwordProp: 'password',
      passReqToCallback: true,
    },
    authenticate
  )
);

passport.serializeUser((user: any, done) => {
  logger.debug('serializeUser %o', user);
  done(null, user?.userId);
});

passport.deserializeUser((user, done) => {
  logger.debug('deserialize %o', user);
  done(null, user as Express.User);
});

// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !!process.env.TRUST_PROXY;
if (!isDev && !process.env.SESSION_SECRET) throw new Error('No session secret given');

const nextApp = next_({ dev: isDev });
const handle = nextApp.getRequestHandler();

export default nextApp.prepare()
  .then(() => {
    const server = express();

    const directives: any = {
      imgSrc: "'self' https://uploads.mangadex.org data:", // data: used by redoc
      workerSrc: "'self' blob:", // blob: used by redoc
    };
    if (isDev) {
      directives.scriptSrc = "'self' 'unsafe-eval'"; // required for fast refresh
    }

    server.use(helmet({
      contentSecurityPolicy: {
        directives,
        useDefaults: true,
      },
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: !isDev,
    }));
    if (reverseProxy) server.set('trust proxy', process.env.TRUST_PROXY);

    const store = new PostgresStore({
      conn: db,
      cacheSize: 30,
      maxAge: 7200000,
      clearInterval: isTest ? null : 7.2e+6,
    });
    server.sessionStore = store;

    server.use(pinoHttp({ logger: expressLogger, useLevel: 'debug' }));

    server.use(express.json());
    server.use(express.urlencoded({ extended: false }));

    server.use(cookieParser(undefined));
    server.use(session({
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
    }));

    server.use(csrf({ cookie: false }));

    if (process.env.NODE_ENV !== 'test') {
      server.use(rateLimiter);
    }
    server.use(passport.initialize());
    server.use(passport.session());
    server.use(checkAuth(server));

    server.use((req, res, next) => {
      logger.debug('Auth cookie: %s', req.cookies.auth);

      res.on('finish', () => {
        expressLogger.info('%s %s %s %s  User Agent: %s',
          res.statusCode,
          req.method,
          req.ip,
          req.originalUrl,
          req.headers['user-agent']);
      });

      // if (!req.originalUrl.startsWith('/_next/static')) debug(req.originalUrl);
      next();
    });

    server.use('/api/login', bruteforce.prevent);
    server.post('/api/login',
      passport.authenticate('json'),
      (req, res) => {
        if (req.body.rememberme === true) {
          // The user field is set by passport instead of express session here
          createRememberMeToken(req, req.user as any as User)
            .then(token => {
              res.cookie('auth', token, {
                maxAge: 2592000000, // 30d in ms
                httpOnly: true,
                secure: !isDev,
                sameSite: 'lax',
              });
              res.redirect('/');
            })
            .catch(err => {
              expressLogger.error(err);
              res.sendStatus(500);
            });
        } else {
          setUserOnLogin(req, req.user as any as User);
          res.redirect('/');
        }
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

    server.get('/login', requiresUser, (req, res) => {
      sessionLogger.debug(req.session.userId);
      if (!req.isAuthenticated || req.isAuthenticated()) {
        res.redirect('/');
        return;
      }
      return nextApp.render(req, res, '/login');
    });

    server.get('/_next/static/*', (req, res) => handle(req, res));

    // inject user data into getServerSideProps
    server.get('/_next/*', requiresUser, (req, res) => handle(req, res));

    server.get('/api/authCheck', requiresUser, (req, res) => {
      if (!req.user) {
        res.status(401).end();
        return;
      }
      res.json({ user: req.user });
    });

    server.get('/manga/:mangaId(\\d+)', requiresUser, (req, res) => handle(req, res));

    server.get('/*', requiresUser, (req, res) => {
      sessionLogger.debug('User %o', req.user);
      return handle(req, res);
    });

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
