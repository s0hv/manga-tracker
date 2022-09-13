import { body, matchedData, param } from 'express-validator';

import { requiresUser } from '@/db/auth';
import { handleError } from '@/db/utils';
import {
  updateService,
  updateServiceWhole,
  updateServiceConfig,
} from '@/db/services';
import {
  validateAdminUser,
  handleValidationErrors,
  serviceIdValidation,
  isISO8601Duration,
} from '../../utils/validators.js';

export default app => {
  const validateService = [
    body('service')
      .isObject()
      .optional(),
    body('service.serviceName')
      .isString()
      .optional(),
    body('service.disabled')
      .isBoolean({ strict: true })
      .optional()
      .toBoolean(true),

    body('serviceWhole')
      .isObject()
      .optional(),
    body('serviceWhole.nextUpdate')
      .isISO8601({ strict: true })
      .optional({ nullable: true })
      .toDate(),

    body('serviceConfig')
      .isObject()
      .optional(),
    isISO8601Duration(body('serviceConfig.checkInterval'))
      .optional(),
    body('serviceConfig.scheduledRunLimit')
      .isInt({ min: 1, max: 100 })
      .optional()
      .withMessage('scheduledRunLimit must be between 1 and 100'),
    body('serviceConfig.scheduledRunsEnabled')
      .isBoolean({ strict: true })
      .optional()
      .toBoolean(),
    isISO8601Duration(body('serviceConfig.scheduledRunInterval'))
      .optional(),
  ];

  app.post('/api/admin/editService/:serviceId', requiresUser, [
    validateAdminUser(),
    serviceIdValidation(param('serviceId')),
    ...validateService,
    handleValidationErrors,
  ], (req, res) => {
    const {
      service,
      serviceWhole,
      serviceConfig,
    } = matchedData(req, { includeOptionals: false, onlyValidData: true });

    const serviceId = req.params.serviceId;

    const serviceArgsExist = service && Object.keys(service).length !== 0;
    const serviceWholeArgsExist = serviceWhole && Object.keys(serviceWhole).length !== 0;
    const serviceConfigArgsExist = serviceConfig && Object.keys(serviceConfig).length !== 0;

    if (!serviceArgsExist && !serviceWholeArgsExist && !serviceConfigArgsExist) {
      res.status(400).json({ error: 'No valid fields given to update' });
      return;
    }

    req.log.info('Updating service with %o', req.body);

    const promise = Promise.resolve();

    if (serviceWholeArgsExist) {
      promise.then(() => updateServiceWhole({ ...serviceWhole, serviceId }));
    }

    if (serviceArgsExist) {
      promise.then(() => updateService({ ...service, serviceId }));
    }

    if (serviceConfigArgsExist) {
      promise.then(() => updateServiceConfig({ ...serviceConfig, serviceId }));
    }

    promise
      .then(() => res.json({ message: 'OK' }))
      .catch(err => handleError(err, res));
  });
};
