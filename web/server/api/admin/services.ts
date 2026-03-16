import express from 'express';
import type { Application } from 'express-serve-static-core';
import * as z from 'zod';

import {
  databaseIdStr,
  iso8601Duration, validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import {
  updateService,
  updateServiceConfig,
  updateServiceWhole,
} from '@/db/services';
import { handleError } from '@/db/utils';


const Service = z.strictObject({
  serviceName: z.string().optional(),
  disabled: z.boolean().optional(),
});

const ServiceWhole = z.strictObject({
  nextUpdate: z.iso.datetime()
    .transform(value => new Date(value)).nullable().optional(),
});

const ServiceConfig = z.strictObject({
  checkInterval: iso8601Duration.optional(),
  scheduledRunLimit: z.number()
    .min(1)
    .max(100)
    .optional(),
  scheduledRunsEnabled: z.boolean().optional(),
  scheduledRunInterval: iso8601Duration.optional(),
});

const ServiceFullSchema = z.strictObject({
  service: Service.optional(),
  serviceWhole: ServiceWhole.optional(),
  serviceConfig: ServiceConfig.optional(),
});

export const router = express.Router();

router.use(validateAdminUser);

router.post('/editService/:serviceId',
  validateRequest({
    params: z.object({ serviceId: databaseIdStr }),
    body: ServiceFullSchema,
  }),
  (req, res) => {
    const {
      service,
      serviceWhole,
      serviceConfig,
    } = req.body;

    const serviceId = req.params.serviceId;

    const serviceArgsExist = service && Object.keys(service).length !== 0;
    const serviceWholeArgsExist = serviceWhole && Object.keys(serviceWhole).length !== 0;
    const serviceConfigArgsExist = serviceConfig && Object.keys(serviceConfig).length !== 0;

    if (!serviceArgsExist && !serviceWholeArgsExist && !serviceConfigArgsExist) {
      res.status(400).json({ error: 'No valid fields given to update' });
      return;
    }

    req.log.info('Updating service with %o', req.body);

    const promises: Promise<unknown>[] = [];

    if (serviceWholeArgsExist) {
      promises.push(updateServiceWhole({ ...serviceWhole, serviceId }));
    }

    if (serviceArgsExist) {
      promises.push(updateService({ ...service, serviceId }));
    }

    if (serviceConfigArgsExist) {
      promises.push(updateServiceConfig({ ...serviceConfig, serviceId }));
    }

    Promise.all(promises)
      .then(() => res.json({ message: 'OK' }))
      .catch(err => handleError(err, res));
  });

export default (app: Application) => {
  app.use('/api/admin', router);
};
