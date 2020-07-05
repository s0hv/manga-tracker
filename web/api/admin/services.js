const format = require('pg-format');

const { requiresUser } = require('../../db/auth');
const pool = require('../../db');

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

    console.log(req.body);
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
    const usableColumns = [...serviceColumns, ...serviceWholeColumns];
    const values = usableColumns.map(c => {
      const val = req.body[c];
      return val === undefined ? false : { col: c, value: val };
    }).filter(x => x);

    if (values.length === 0) {
      res.status(400).json({ error: 'No valid values given' });
      return;
    }

    function generateValues(filterCols) {
      const cols = new Set(filterCols);
      const sqlValues = [];
      const columns = [];
      const args = [];

      values.filter(v => cols.has(v.col)).forEach((v, idx) => {
        sqlValues.push(`%I=$${idx+1}`);
        columns.push(v.col);
        args.push(v.value);
      });

      const sqlCols = format(sqlValues.join(','), columns);

      return { sqlCols, args };
    }

    function updateServiceWhole() {
      const { sqlCols, args } = generateValues(serviceWholeColumns);
      if (args.length === 0) return Promise.resolve();

      const sql = `UPDATE service_whole SET ${sqlCols} WHERE service_id=$${args.length+1}`;
      args.push(req.body.service_id);
      return pool.query(sql, args);
    }

    const { sqlCols, args } = generateValues(serviceColumns);

    const sql = `UPDATE services SET ${sqlCols} WHERE service_id=$${args.length+1}`;
    args.push(req.body.service_id);
    updateServiceWhole()
      .then(() => {
        if (args.length <= 1) return Promise.resolve();
        return pool.query(sql, args);
      })
      .then(() => res.status(200).json({ message: 'OK' }))
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
      });
  });
};
