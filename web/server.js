const dev = process.env.NODE_ENV !== 'production';

// Read .env if in development
if (dev) {
  // eslint-disable-next-line import/no-extraneous-dependencies
  require('dotenv').config({ path: '../.env' });
}

const express = require('express');
const next_ = require('next');
const session = require('express-session');
const passport = require('passport');
const JsonStrategy = require('passport-json');

const sessionDebug = require('debug')('session-debug');
const debug = require('debug')('debug');

const db = require('./db');
const PostgresStore = require('./db/session-store')(session);
const { checkAuth, authenticate, requiresUser } = require('./db/auth');
const { bruteforce, rateLimiter } = require('./utils/ratelimits');

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
const reverseProxy = !dev;
if (!dev && !process.env.SESSION_SECRET) throw new Error('No session secret given');

const nextApp = next_({ dev: dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

module.exports = nextApp.prepare()
  .then(() => {
    const server = express();
    server.disable('x-powered-by');
    if (reverseProxy) server.enable('trust-proxy');

    const store = new PostgresStore({
      conn: db.pool,
      cacheSize: 30,
      maxAge: 7200000,
    });
    server.sessionStore = store;

    server.use(require('body-parser').json());

    server.use(require('cookie-parser')(null));
    server.use(session({
      name: 'sess',
      cookie: {
        maxAge: 7200000,
        sameSite: 'strict',
        httpOnly: true,
        secure: !dev,
      },
      proxy: reverseProxy,
      secret: dev ? 'secret' : process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,

      store: store,
    }));

    if (process.env.NODE_ENV !== 'test') {
      server.use(rateLimiter);
    }
    server.use(passport.initialize());
    server.use(checkAuth(server));

    server.use((req, res, next) => {
      debug('Auth cookie:', req.cookies.auth);
      debug(req.originalUrl);
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
            secure: !dev,
            sameSite: 'strict',
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

    server.get('/login', requiresUser, (req, res) => {
      sessionDebug(req.session.user_id);
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

    server.get('/manga/:manga_id(\\d+)', requiresUser, (req, res) => handle(req, res));

    server.get('/*', requiresUser, (req, res) => {
      sessionDebug('User', req.user);
      return handle(req, res);
    });

    server.get('*', (req, res) => handle(req, res));

    const port = process.env.PORT || 3000;

    return server.listen(port, () => {
      console.log('Listening on port', port);
    });
  })
  .catch(console.error);
