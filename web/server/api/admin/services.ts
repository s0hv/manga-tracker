import type { Application, Request, Response } from 'express-serve-static-core';
import { body, matchedData, param } from 'express-validator';

import {
  updateService,
  updateServiceConfig,
  updateServiceWhole,
} from '@/db/services';
import { handleError } from '@/db/utils';
import type { Service, ServiceConfig, ServiceWhole } from '@/types/db/services';

import {
  handleValidationErrors,
  isISO8601Duration,
  serviceIdValidation,
  validateAdminUser,
} from '../../utils/validators';

export default (app: Application) => {
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

  app.post('/api/admin/editService/:serviceId', [
    validateAdminUser(),
    serviceIdValidation(param('serviceId')),
    ...validateService,
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const {
      service,
      serviceWhole,
      serviceConfig,
    } = matchedData<{
      service?: Service
      serviceWhole?: ServiceWhole
      serviceConfig?: ServiceConfig
    }>(req, { includeOptionals: false, onlyValidData: true });

    const serviceId = Number(req.params.serviceId);

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
