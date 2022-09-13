import { db } from '../helpers';
import { generateUpdate } from '../utils';

import type { DatabaseId } from '@/types/dbTypes';
import type { Service, ServiceConfig, ServiceWhole } from '@/types/db/services';
import type { PartialExcept } from '@/types/utility';


export const getService = (serviceId: DatabaseId) => db.oneOrNone<Service>`SELECT * FROM services WHERE service_id=${serviceId}`;

export const getServiceWhole = (serviceId: DatabaseId) => db.oneOrNone<ServiceWhole>`SELECT * FROM service_whole WHERE service_id=${serviceId}`;

export const getServiceConfig = (serviceId: DatabaseId) => db.oneOrNone<ServiceConfig>`SELECT * FROM service_config WHERE service_id=${serviceId}`;

export const getServiceFull = (serviceId: DatabaseId) => {
  const retVal: {
    service?: Service | null,
    serviceWhole?: ServiceWhole | null,
    serviceConfig?: ServiceConfig | null
  } = {};

  return Promise.all([
    getService(serviceId).then(row => { retVal.service = row }),
    getServiceWhole(serviceId).then(row => { retVal.serviceWhole = row }),
    getServiceConfig(serviceId).then(row => { retVal.serviceConfig = row }),
  ])
    .then(() => retVal);
};

/**
 * Update service row
 */
export const updateService = ({
  serviceId,
  serviceName,
  url,
  chapterUrlFormat,
  mangaUrlFormat,
  disabled,
  disabledUntil,
}: PartialExcept<Service, 'serviceId'>) => {
  const service = {
    service_name: serviceName,
    url,
    chapter_url_format: chapterUrlFormat,
    manga_url_format: mangaUrlFormat,
    disabled,
    disabled_until: disabledUntil,
  };

  return db.sql`UPDATE services SET ${generateUpdate(service, db.sql)} WHERE service_id=${serviceId}`
    .execute();
};

/**
 * Update service_whole row
 */
export const updateServiceWhole = ({
  serviceId,
  feedUrl,
  nextUpdate,
  lastId,
}: PartialExcept<ServiceWhole, 'serviceId'>) => {
  const serviceWhole = {
    feed_url: feedUrl,
    next_update: nextUpdate,
    last_id: lastId,
  };

  return db.sql`UPDATE service_whole SET ${generateUpdate(serviceWhole, db.sql)} WHERE service_id=${serviceId}`
    .execute();
};

/**
 * Update service_config row
 */
export const updateServiceConfig = ({
  serviceId,
  checkInterval,
  scheduledRunInterval,
  scheduledRunLimit,
  scheduledRunsEnabled,
}: PartialExcept<ServiceConfig, 'serviceId'>) => {
  const serviceConfig = {
    checkInterval,
    scheduledRunInterval,
    scheduledRunLimit,
    scheduledRunsEnabled,
  };
  return db.sql`UPDATE service_config SET ${generateUpdate(serviceConfig, db.sql)} WHERE service_id=${serviceId}`
    .execute();
};

/**
 * Get all service configs
 */
export const getServiceConfigs = (): Promise<ServiceConfig[]> => {
  return db.many<ServiceConfig>`SELECT * FROM service_config`;
};

