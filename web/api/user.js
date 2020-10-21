const { body } = require('express-validator');
const { UNIQUE_VIOLATION } = require('pg-error-constants');

const sessionDebug = require('debug')('session-debug');
const userDebug = require('debug')('user-debug');


const { insertFollow, deleteFollow } = require('../db/follows');
const { handleError } = require('../db/utils');
const {
  mangaIdValidation,
  serviceIdValidation,
  hadValidationError,
  validateUser,
  newPassword,
  passwordRequired,
} = require('../utils/validators');
const {
  requiresUser,
  clearUserAuthTokens,
  generateAuthToken,
  clearUserAuthToken,
} = require('../db/auth');
const db = require('../db');
const { regenerateSession } = require('../utils/utilities');

const dev = process.env.NODE_ENV !== 'production';


const MAX_USERNAME_LENGTH = 100;

module.exports = app => {
  app.post('/api/profile', requiresUser, [
    validateUser(),
    newPassword('newPassword', 'repeatPassword'),
    body('email')
      .if(body('email').exists())
      .isEmail()
      .custom(passwordRequired),
    body('username')
      .isString()
      .optional()
      .bail()
      .isLength({ max: MAX_USERNAME_LENGTH })
      .withMessage(`Max username length is ${MAX_USERNAME_LENGTH}`)
      .optional(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    sessionDebug(req.body);

    const args = [req.user.user_id];
    const cols = [];
    const {
      newPassword: newPass,
      email,
      username,
      password,
    } = req.body;
    let pw = false;

    // Use this only after pushing to args
    function getIndex() {
      return args.length;
    }

    if (newPass) {
      pw = true;
      args.push(newPass);
      cols.push(`pwhash=crypt($${getIndex()}, gen_salt('bf'))`);
    }

    if (email) {
      args.push(email);
      cols.push(`email=$${getIndex()}`);
      pw = true;
    }

    if (username) {
      args.push(username);
      cols.push(`username=$${getIndex()}`);
    }

    if (cols.length === 0) {
      res.status(400).json({ error: 'Nothing to change' });
      return;
    }

    if (pw) {
      args.push(password);
    }
    const pwCheck = ` AND pwhash=crypt($${getIndex()}, pwhash)`;
    const sql = `UPDATE users
                 SET ${cols.join(',')}
                 WHERE user_id=$1 ${pw ? pwCheck : ''}`;

    db.query(sql, args)
      .then(rows => {
        if (rows.rowCount === 0) {
          res.status(401).json({ error: 'Invalid password' });
          return;
        }

        if (pw) {
          app.sessionStore.clearUserSessions(req.user.user_id, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Internal server error' });
            }

            clearUserAuthTokens(req.user.user_id)
              .then(() => {
                if (!req.cookies.auth) {
                  regenerateSession(req)
                    .catch(sessionDebug)
                    .finally(() => res.status(200).end());
                  return;
                }

                generateAuthToken(req.user.user_id, req.user.uuid)
                  .then(token => {
                    res.cookie('auth', token, {
                      maxAge: 2592000000, // 30d in ms
                      secure: !dev,
                      httpOnly: true,
                      sameSite: 'strict',
                    });
                    regenerateSession(req)
                      .catch(sessionDebug)
                      .finally(() => res.status(200).end());
                  })
                  .catch(genErr => {
                    console.error(genErr);
                    res.status(500).json({ error: 'Internal server error' });
                  });
              })
              .catch(clearErr => {
                console.error(clearErr);
                res.status(500).json({ error: 'Internal server error' });
              });
          });
        } else {
          res.status(200).end();
        }
      })
      .catch(err => handleError(
        err,
        res,
        { [UNIQUE_VIOLATION]: 'Email is already in use' }
      ));
  });

  app.post('/api/logout', requiresUser, (req, res) => {
    if (!req.user.user_id) return res.redirect('/');

    userDebug('Logging out user', req.user.user_id);

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

  app.put('/api/user/follows', requiresUser, [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    insertFollow(req.user.user_id, req.query.manga_id, req.query.service_id)
      .then(() => res.status(200).end())
      .catch(err => handleError(err, res));
  });

  app.delete('/api/user/follows', requiresUser, [
    mangaIdValidation(),
    serviceIdValidation().optional(),
    validateUser(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    deleteFollow(req.user.user_id, req.query.manga_id, req.query.service_id)
      .then(rows => {
        if (rows.rowCount === 0) return res.status(404).end();
        res.status(200).end();
      })
      .catch(err => handleError(err, res));
  });
};
