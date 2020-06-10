const express = require('express')
const next = require('next')
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');

const pool = require('./db');
const PostgresStore = require('./db/session-store')(session);
const { checkAuth, authenticate, requiresUser } = require('./db/auth');
const { bruteforce, rateLimiter } = require('./utils/ratelimits');

const sessionDebug = require('debug')('session-debug');
const debug = require('debug')('debug');

passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    authenticate
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

const dev = process.env.NODE_ENV !== 'production';
// Turn off when not using this app with a reverse proxy like heroku
const reverseProxy = !dev;
if (!dev && !process.env.SESSION_SECRET) throw new Error('No session secret given');

nextApp = next({ dev: dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

module.exports = nextApp.prepare()
    .then(() => {
    const server = express();
    const store = new PostgresStore({
            conn: pool,
            cacheSize: 30,
            maxAge: 7200000,
        });
    server.sessionStore = store;

    server.use(require('body-parser').urlencoded({extended: true}));
    reverseProxy && server.enable('trust-proxy')
    server.use(require('cookie-parser')(null));
    server.use(session({
        name: 'sess',
        cookie: {
            maxAge: 7200000,
            sameSite: 'strict',
            httpOnly: true,
            secure: !dev
        },
        proxy: reverseProxy,
        secret: dev ? 'secret' : process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        store: store,
    }));

    server.use(passport.initialize());
    server.use(checkAuth(server));
    server.use('/api/*', rateLimiter);

    server.use('/api/login', bruteforce.prevent);
    server.post('/api/login',
        passport.authenticate('local'),
        function (req, res) {
            if (req.body.rememberme === "on") {
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

    server.get('/login', requiresUser, (req, res) => {
        sessionDebug(req.session.user_id);
        if (req.isAuthenticated()) {
            res.redirect('/');
            return;
        }
        return nextApp.render(req, res, '/login');
    });

    server.use((req, res, next) => {if (!req.originalUrl.startsWith('/_next/static')) debug(req.originalUrl); next();});

    server.get('/_next/static/*', (req, res) => {
        return handle(req, res);
    });

    server.use('/_next/*', rateLimiter);
    // inject user data into getServerSideProps
    server.get('/_next/*', requiresUser, (req, res) => {
        return handle(req, res);
    });

    server.get('/api/authCheck', requiresUser, (req, res) => {
        res.json({user: req.user});
    });

    server.get('/manga/:manga_id(\\d+)', requiresUser, (req, res) => {
        return handle(req, res);
    });

    server.get('/*', requiresUser, (req, res) => {
        sessionDebug('User', req.user);
        return handle(req, res);
    });

    server.get('*', (req, res) => {
        //console.log(req.path);
        return handle(req, res);
    });

    const port = process.env.PORT || 3000;
    return server.listen(port, () => {
        console.log('Listening on port', port);
    });
})
    .catch(console.error);