const dblog = require('debug')('db');

const { requiresUser } = require('../../db/auth');
const { generateEqualsColumns, handleError } = require('../../db/utils');
const db = require('../../db');

module.exports = app => {
  app.use('/api/admin/editService', require('body-parser').json());
  app.post('/api/admin/editService', requiresUser, (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }
    if (!req.user.admin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ error: 'Empty body' });
      return;
    }

    if (!req.body.service_id) {
      res.status(400).json({ error: 'No service id given' });
      return;
    }

    const serviceColumns = ['service_name', 'disabled'];
    const serviceWholeColumns = ['next_update'];


    function updateServiceWhole() {
      const { sqlCols, args } = generateEqualsColumns(req.body, serviceWholeColumns);
      if (args.length === 0) return Promise.resolve();

      const sql = `UPDATE service_whole SET ${sqlCols} WHERE service_id=$${args.length+1}`;
      args.push(req.body.service_id);
      return db.query(sql, args);
    }

    const { sqlCols, args } = generateEqualsColumns(req.body, serviceColumns);

    if (args.length === 0) {
      res.status(400).json({ error: 'No valid values given' });
      return;
    }

    dblog('Updating service with', req.body);

    const sql = `UPDATE services SET ${sqlCols} WHERE service_id=$${args.length+1}`;
    args.push(req.body.service_id);
    updateServiceWhole()
      .then(() => {
        if (args.length <= 1) return Promise.resolve();
        return db.query(sql, args);
      })
      .then(() => res.status(200).json({ message: 'OK' }))
      .catch(err => {
        handleError(err, res);
      });
  });
};
