import type { Service, ServiceConfig, ServiceWhole } from '@/types/db/services';
import type { DatabaseId } from '@/types/dbTypes';
import type { PartialExcept } from '@/types/utility';

import { db, sql, voidSql } from '../index';
import {
  ServiceConfigRow,
  ServiceRow,
  ServiceWholeRow,
} from '../schemas/services';
import { updateSet } from '../utils';


export const getService = (serviceId: DatabaseId) => db.maybeOne(sql.type(ServiceRow)`SELECT * FROM services WHERE service_id=${serviceId}`);

export const getServiceWhole = (serviceId: DatabaseId) => db.maybeOne(sql.type(ServiceWholeRow)`SELECT * FROM service_whole WHERE service_id=${serviceId}`);

export const getServiceConfig = (serviceId: DatabaseId) => db.maybeOne(sql.type(ServiceConfigRow)`SELECT * FROM service_config WHERE service_id=${serviceId}`);

export const getServiceFull = (serviceId: DatabaseId) => {
  const retVal: {
    service?: Service | null;
    serviceWhole?: ServiceWhole | null;
    serviceConfig?: ServiceConfig | null;
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
  return db.query(voidSql`UPDATE services SET ${updateSet({
    serviceName,
    url,
    chapterUrlFormat,
    mangaUrlFormat,
    disabled,
    disabledUntil,
  })} WHERE service_id=${serviceId}`);
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
  const updates = updateSet({ feedUrl, nextUpdate, lastId });
  return db.query(voidSql`UPDATE service_whole SET ${updates} WHERE service_id=${serviceId}`);
};


interface UpdateServiceConfig extends Omit<
  PartialExcept<ServiceConfig, 'serviceId'>,
  'scheduledRunInterval'
  | 'checkInterval'
> {
  // These will be strings when inserting to thedb
  scheduledRunInterval?: string;
  checkInterval?: string;
}

/**
 * Update service_config row
 */
export const updateServiceConfig = ({
  serviceId,
  checkInterval,
  scheduledRunInterval,
  scheduledRunLimit,
  scheduledRunsEnabled,
}: UpdateServiceConfig) => {
  return db.query(voidSql`UPDATE service_config SET ${updateSet({
    checkInterval,
    scheduledRunInterval,
    scheduledRunLimit,
    scheduledRunsEnabled,
  })} WHERE service_id=${serviceId}`);
};

/**
 * Get all service configs
 */
export const getServiceConfigs = () => {
  return db.many(sql.type(ServiceConfigRow)`SELECT * FROM service_config`);
};
