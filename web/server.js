const express = require('express')
const next = require('next')
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');

const pool = require('./db');
const PostgresStore = require('./db/session-store')(session);
const { getUserFollows } = require('./db/db');
const { checkAuth, authenticate, requiresUser } = require('./db/auth');
const { quickSearch } = require('./api/search');
const { bruteforce, rateLimiter } = require('./utils/ratelimits');

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
    server.use(require('cookie-parser')());
    server.use(session({
        name: 'sess',
        cookie: {
            maxAge: 7200000,
            sameSite: 'strict',
            httpOnly: true,
        },
        secret: 'secret',
        resave: false,
        saveUninitialized: false,

        store: store,
    }));

    server.use(passport.initialize());
    server.use(checkAuth(server));
    server.use('/api/*', rateLimiter)

    server.use('/api/login', bruteforce.prevent);
    server.post('/api/login',
        passport.authenticate('local'),
        function (req, res) {
            if (req.body.rememberme === "on") {
                res.cookie('auth', req.user, {
                    maxAge: 2592000000, // 30d in ms
                    httpOnly: true,
                    sameSite: 'strict',
                });
            }
            console.log('Done')
            res.redirect('/');
        });

    server.get('/api/quicksearch', (req, res) => {
        if (!req.query.query) {
            console.log('none')
            return res.json([]);
        }

        quickSearch(req.query.query, (results) => {
            console.log(results);
            res.json(results || []);
        })
    });

    require('./api/rss')(server);
    require('./api/manga')(server);
    require('./api/user')(server);

    server.get('/login', requiresUser, (req, res) => {
        console.log(req.session.user_id);
        if (req.isAuthenticated()) {
            res.redirect('/');
            return;
        }
        return nextApp.render(req, res, '/login');
    });

    server.get('/_next/*', (req, res) => {
        return handle(req, res);
    });

    server.get('/api/authCheck', requiresUser, (req, res) => {
        res.json({user: req.user});
    })

    server.get('/manga/:manga_id(\\d+)', requiresUser, (req, res) => {
        console.log('params', req.params);
        if (req.user) {
            getUserFollows(req.user.user_id, req.params.manga_id)
                .then(rows => {
                    req.user_follows = rows.rows.map(row => row.service_id);
                    handle(req, res);
                })
                .catch(err => {
                    if (!(err.code === '22003')) {
                        console.error(err);
                        res.redirect('/404');
                        return;
                    }

                    handle(req, res);
                });
            return;
        }
        return handle(req, res);
    });

    server.get('/*', requiresUser, (req, res) => {
        console.log('User', req.user);
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