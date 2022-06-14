import { requiresUser, modifyCacheUser } from '../db/auth.js';
import { positiveTinyInt, hadValidationError } from '../utils/validators.js';
import { query } from '../db/index.js';
import { handleError } from '../db/utils.js';


export default app => {
  app.post('/api/settings/theme', requiresUser, [
    positiveTinyInt('value'),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const val = Number(req.query.value);

    if (req.user) {
      const sql = `UPDATE users SET theme=$1 WHERE user_id=$2`;
      query(sql, [val, req.user.userId])
        .then(() => {
          modifyCacheUser(parseInt(req.user.userId), { theme: val });
          res.status(200).end();
        })
        .catch(err => handleError(err, res));
      return;
    }

    req.session.theme = val;
    res.status(200).end();
  });
};
