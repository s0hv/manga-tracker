const dblog = require('debug')('db');
const { body } = require('express-validator');

const { requiresUser } = require('../../db/auth');
const { generateEqualsColumns, handleError } = require('../../db/utils');
const db = require('../../db');
const {
  validateAdminUser,
  hadValidationError,
} = require('../../utils/validators');

module.exports = app => {
  app.use('/api/admin/editService', require('body-parser').json());
  app.post('/api/admin/editService', requiresUser, [
    validateAdminUser(),
    body('disabled').isBoolean().optional(),
    body('service_name').isString().optional(),
    body('next_update').isISO8601({ strict: true }).optional({ nullable: true }).toDate(),
    body('service_id').isInt(),
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    const serviceColumns = ['service_name', 'disabled'];
    const serviceWholeColumns = ['next_update'];

    const { sqlCols: sqlColsWhole, args: argsWhole } = generateEqualsColumns(req.body, serviceWholeColumns);
    function updateServiceWhole() {
      if (argsWhole.length === 0) return Promise.resolve();

      const sql = `UPDATE service_whole SET ${sqlColsWhole} WHERE service_id=$${argsWhole.length+1}`;
      argsWhole.push(req.body.service_id);
      return db.query(sql, argsWhole);
    }

    const { sqlCols, args } = generateEqualsColumns(req.body, serviceColumns);

    if (args.length === 0 && argsWhole.length === 0) {
      res.status(400).json({ error: 'No valid fields given to update' });
      return;
    }

    dblog('Updating service with', req.body);

    const sql = `UPDATE services SET ${sqlCols} WHERE service_id=$${args.length+1}`;
    args.push(req.body.service_id);
    updateServiceWhole()
      .then(() => args.length > 1 && db.query(sql, args))
      .then(() => res.status(200).json({ message: 'OK' }))
      .catch(err => handleError(err, res));
  });
};
