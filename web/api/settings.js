const { requiresUser, modifyCacheUser } = require('../db/auth');
const { positiveTinyInt, hadValidationError } = require('../utils/validators');
const db = require('../db');
const { handleError } = require('../db/utils');


module.exports = app => {
  app.post('/api/settings/theme', requiresUser, [
    positiveTinyInt('value'),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const val = Number(req.query.value);

    if (req.user) {
      const sql = `UPDATE users SET theme=$1 WHERE user_id=$2`;
      db.query(sql, [val, req.user.user_id])
        .then(() => {
          modifyCacheUser(parseInt(req.user.user_id), { theme: val });
          res.status(200).end();
        })
        .catch(err => handleError(err, res));
      return;
    }

    req.session.theme = val;
    res.status(200).end();
  });
};
