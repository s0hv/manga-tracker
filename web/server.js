import express from 'express';
import next_ from 'next';
import csrf from 'csurf';
import session from 'express-session';
import passport from 'passport';
import JsonStrategy from 'passport-json';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import { isDev, isTest, csrfMissing } from './utils/constants.js';
import { db } from './db/index.js';
import PostgresStoreGen from './db/session-store.js';
import { checkAuth, authenticate, requiresUser } from './db/auth.js';
import { bruteforce, rateLimiter } from './utils/ratelimits.js';
import { logger, expressLogger, sessionLogger } from './utils/logging.js';

import {
  chapterApi,
  mangaApi,
  notificationsApi,
  rssApi,
  searchApi,
  servicesApi,
  settingsApi,
  userApi,
  adminMangaApi,
  adminServicesApi
} from './api/index.js';

const PostgresStore = PostgresStoreGen(session);
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

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !isDev;
if (!isDev && !process.env.SESSION_SECRET) throw new Error('No session secret given');

const nextApp = next_({ dev: isDev });
const handle = nextApp.getRequestHandler();

export default nextApp.prepare()
  .then(() => {
    /** @type import('express').Express */
    const server = express();

    const directives = {
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
    }));
    if (reverseProxy) server.enable('trust-proxy');

    const store = new PostgresStore({
      conn: db,
      cacheSize: 30,
      maxAge: 7200000,
      clearInterval: isTest ? null : 7.2e+6,
    });
    server.sessionStore = store;

    server.use(pinoHttp({ logger: expressLogger, useLevel: 'debug' }));

    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({ extended: false }));

    server.use(cookieParser(null));
    server.use(session({
      name: 'sess',
      cookie: {
        maxAge: 7200000,
        sameSite: 'lax',
        httpOnly: true,
        secure: !isDev,
      },
      proxy: reverseProxy,
      secret: isDev ? 'secret' : process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,

      store: store,
    }));

    server.use(csrf({ cookie: false }));

    if (process.env.NODE_ENV !== 'test') {
      server.use(rateLimiter);
    }
    server.use(passport.initialize());
    server.use(checkAuth(server));

    server.use((req, res, next) => {
      logger.debug('Auth cookie: %s', req.cookies.auth);
      logger.debug(req.originalUrl);
      // if (!req.originalUrl.startsWith('/_next/static')) debug(req.originalUrl);
      next();
    });

    server.use('/api/login', bruteforce.prevent);
    server.post('/api/login',
      passport.authenticate('json'),
      (req, res) => {
        if (req.body.rememberme === true) {
          res.cookie('auth', req.user, {
            maxAge: 2592000000, // 30d in ms
            httpOnly: true,
            secure: !isDev,
            sameSite: 'lax',
          });
        }
        res.redirect('/');
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
    server.use((err, req, res, next) => {
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
