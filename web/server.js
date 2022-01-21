// eslint-disable-next-line import/order
const { isDev, isTest } = require('./utils/constants');

// Read .env if in isDevelopment
if (isDev) {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('dotenv').config({ path: '../.env' });
}

const express = require('express');
const next_ = require('next');
const csrf = require('csurf');
const session = require('express-session');
const passport = require('passport');
const JsonStrategy = require('passport-json');
const helmet = require('helmet');

const { db } = require('./db');
const { csrfMissing } = require('./utils/constants');
const PostgresStore = require('./db/session-store')(session);
const { checkAuth, authenticate, requiresUser } = require('./db/auth');
const { bruteforce, rateLimiter } = require('./utils/ratelimits');
const { logger, expressLogger, sessionLogger } = require('./utils/logging');

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

const nextApp = next_({ dev: isDev, dir: __dirname });
const handle = nextApp.getRequestHandler();

module.exports = nextApp.prepare()
  .then(() => {
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
    }));
    if (reverseProxy) server.enable('trust-proxy');

    const store = new PostgresStore({
      conn: db,
      cacheSize: 30,
      maxAge: 7200000,
      clearInterval: isTest ? null : 7.2e+6,
    });
    server.sessionStore = store;

    server.use(require('pino-http')({ logger: expressLogger, useLevel: 'debug' }));

    server.use(require('body-parser').json());
    server.use(require('body-parser').urlencoded({ extended: false }));

    server.use(require('cookie-parser')(null));
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

    require('./api/rss')(server);
    require('./api/manga')(server);
    require('./api/user')(server);
    require('./api/settings')(server);
    require('./api/search')(server);
    require('./api/admin/services')(server);
    require('./api/chapter')(server);
    server.use('/api/admin/manga', require('./api/admin/manga')());

    server.get('/login', requiresUser, (req, res) => {
      sessionLogger.debug(req.session.userId);
      if (req.isAuthenticated()) {
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
