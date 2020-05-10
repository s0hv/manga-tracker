const { requiresUser, modifyCacheUser } = require('./../db/auth');
const pool = require('./../db');


module.exports = function (app) {
    app.post('/api/settings/theme', requiresUser, (req, res) => {
        if (!req.query.value) {
            res.status(400).json({error: 'Query parameter "value" missing'});
            return;
        }

        let val = parseInt(req.query.value);
        if (isNaN(val) || val < 0 || val > 127) {
            res.status(400).json({error: `Query parameter "value" has an invalid value of ${val}`});
            return;
        }

        if (req.user) {
            const sql = `UPDATE users SET theme=$1 WHERE user_id=$2`;
            pool.query(sql, [val, req.user.user_id])
                .then(() => {
                    modifyCacheUser(parseInt(req.user.user_id), {theme: val});
                    res.status(200).end();
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).end();
                });
            return;
        }

        req.session.theme = val;
        res.status(200).end();
    });
}