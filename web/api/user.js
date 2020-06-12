const sessionDebug = require('debug')('session-debug');

const { requiresUser, clearUserAuthTokens, generateAuthToken, clearUserAuthToken } = require('../db/auth');
const pool = require('../db');

const dev = process.env.NODE_ENV !== 'production';


const MAX_USERNAME_LENGTH = 100;
// Rudimentary email check that check that your email is in the format of a@b.c
// I know you apparently can have multiple @ signs in your email but I don't care and filter those out
const emailRegex = /^(?!(.+?@{2,}.+?)|(.+?@.+?){2,}).+?@.+\.\w+$/;

module.exports = app => {
    app.post('/api/profile', requiresUser, (req, res) => {
        if (!req.user) {
            res.status(401).json({ error: 'Not logged in' });
            return;
        }
        sessionDebug(req.body);

        const args = [req.user.user_id];
        const cols = [];
        const { body } = req;
        let pw = false;

        // Use this only after pushing to args
        function getIndex() {
            return args.length;
        }

        if (body.newPassword) {
            if (!body.password) {
                res.status(400).json({ error: 'Tried to change password without old password' });
                return;
            }
            if (body.newPassword !== body.repeatPassword) {
                res.status(400).json({ error: "New passwords don't match" });
                return;
            }
            if (body.newPassword.length > 72) {
                res.status(400).json({ error: 'Password must be 72 or fewer characters' });
                return;
            }

            pw = true;
            args.push(body.newPassword);
            cols.push(`pwhash=crypt($${getIndex()}, gen_salt('bf'))`);
        }

        if (body.email) {
            // TODO email verification and validation
            if (body.email.length > 254 || !emailRegex.test(body.email)) {
                res.status(400).json({ error: 'Invalid email address' });
                return;
            }

            args.push(body.email);
            cols.push(`email=$${getIndex()}`);
            pw = true;
        }

        if (body.username) {
            if (body.username.length > MAX_USERNAME_LENGTH) {
                res.status(400).json({ error: 'Username too long' });
                return;
            }

            args.push(body.username);
            cols.push(`username=$${getIndex()}`);
        }

        if (cols.length === 0) {
            res.status(400).json({ error: 'Nothing to change' });
            return;
        }

        if (pw) {
            args.push(req.body.password);
        }
        const pwCheck = ` AND pwhash=crypt($${getIndex()}, pwhash)`;
        const sql = `UPDATE users SET ${cols.join(',')}
                     WHERE user_id=$1 ${pw ? pwCheck : ''}`;

        pool.query(sql, args)
            .then(rows => {
                if (rows.rowCount === 0) {
                    res.status(401).json({ error: 'Invalid credentials' });
                    return;
                }
                sessionDebug(req.cookies.auth);

                if (pw) {
                    function regen() {
                        req.session.regenerate((err) => {
                            console.error(err);
                            res.status(200).end();
                        });
                    }
                    // callback hell
                    app.sessionStore.clearUserSessions(req.user.user_id, (err) => {
                        if (err) return res.status(500).json({ error: 'Internal server error' });

                        clearUserAuthTokens(req.user.user_id, (clearErr) => {
                            if (clearErr) return res.status(500).json({ error: 'Internal server error' });

                            if (!req.cookies.auth) return regen();
                            generateAuthToken(req.user.user_id, req.user.uuid, (authErr, token) => {
                                if (authErr || !token) return res.status(500).json({ error: 'Internal server error' });

                                res.cookie('auth', token, {
                                            maxAge: 2592000000, // 30d in ms
                                            secure: !dev,
                                            httpOnly: true,
                                            sameSite: 'strict',
                                });
                                regen();
                            });
                        });
                    });
                    return;
                }
                res.status(200).end();
            })
            .catch(err => {
                console.error(err);
                res.status(400).json({ error: 'Invalid values given' });
            });
    });

    app.post('/api/logout', requiresUser, (req, res) => {
        if (!req.user.user_id) return res.redirect('/');

        req.session.destroy((err) => {
            if (err) console.error(err);
            if (req.cookies.auth) {
                clearUserAuthToken(req.user.user_id, req.cookies.auth, () => {
                    res.clearCookie('auth');
                    res.redirect('/');
                });
                return;
            }

            res.redirect('/');
        });
    });
};
