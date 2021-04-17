const dblog = require('debug')('db');
const { body } = require('express-validator');

const { requiresUser } = require('../../db/auth');
const { handleError } = require('../../db/utils');
const { updateService, updateServiceWhole } = require('../../db/services');
const { filterProperties, snakeCaseToCamelCase } = require('../../utils/utilities');
const {
  validateAdminUser,
  hadValidationError,
} = require('../../utils/validators');

module.exports = app => {
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

    const service = snakeCaseToCamelCase(filterProperties(req.body, serviceColumns));
    const serviceWhole = snakeCaseToCamelCase(filterProperties(req.body, serviceWholeColumns));
    const serviceId = req.body.service_id;

    const serviceArgsExist = Object.keys(service).length !== 0;
    const serviceWholeArgsExist = Object.keys(serviceWhole).length !== 0;

    if (!serviceArgsExist && !serviceWholeArgsExist) {
      res.status(400).json({ error: 'No valid fields given to update' });
      return;
    }

    dblog('Updating service with', req.body);

    const promise = Promise.resolve();

    if (serviceWholeArgsExist) {
      promise.then(() => updateServiceWhole({ ...serviceWhole, serviceId }));
    }

    if (serviceArgsExist) {
      promise.then(() => updateService({ ...service, serviceId }));
    }

    promise
      .then(() => res.json({ message: 'OK' }))
      .catch(err => handleError(err, res));
  });
};
