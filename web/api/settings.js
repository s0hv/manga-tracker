import { requiresUser, modifyCacheUser } from '@/db/auth';
import { positiveTinyInt, hadValidationError } from '../utils/validators.js';
import { db } from '@/db/helpers';
import { handleError } from '@/db/utils';


export default app => {
  app.post('/api/settings/theme', requiresUser, [
    positiveTinyInt('value'),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const val = Number(req.query.value);

    if (req.user) {
      db.sql`UPDATE users SET theme=${val} WHERE user_id=${req.user.userId}`
        .execute()
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
