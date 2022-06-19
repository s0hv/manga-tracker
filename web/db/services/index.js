import snakecaseKeys from 'snakecase-keys';
import { db } from '..';
import { generateUpdate } from '../utils.js';


export const getService = (serviceId) => db.oneOrNone('SELECT * FROM services WHERE service_id=$1', [serviceId]);

export const getServiceWhole = (serviceId) => db.oneOrNone('SELECT * FROM service_whole WHERE service_id=$1', [serviceId]);

export const getServiceConfig = (serviceId) => db.oneOrNone('SELECT * FROM service_config WHERE service_id=$1', [serviceId]);

export const getServiceFull = (serviceId) => {
  const retVal = {};

  return Promise.all([
    getService(serviceId).then(row => { retVal.service = row }),
    getServiceWhole(serviceId).then(row => { retVal.serviceWhole = row }),
    getServiceConfig(serviceId).then(row => { retVal.serviceConfig = row }),
  ])
    .then(() => retVal);
};

/**
 * Update service row
 * @returns {Promise<pgPromise.IResultExt>}
 */
export const updateService = ({
  serviceId,
  serviceName,
  url,
  chapterUrlFormat,
  mangaUrlFormat,
  disabled,
  disabledUntil,
}) => {
  const service = {
    service_name: serviceName,
    url,
    chapter_url_format: chapterUrlFormat,
    manga_url_format: mangaUrlFormat,
    disabled,
    disabled_until: disabledUntil,
  };

  const sql = `${generateUpdate(service, 'services')} WHERE service_id=$1`;
  return db.result(sql, [serviceId]);
};

/**
 * Update service_whole row
 * @returns {Promise<pgPromise.IResultExt>}
 */
export const updateServiceWhole = ({
  serviceId,
  feedUrl,
  nextUpdate,
  lastId,
}) => {
  const serviceWhole = {
    feed_url: feedUrl,
    next_update: nextUpdate,
    last_id: lastId,
  };

  const sql = `${generateUpdate(serviceWhole, 'service_whole')} WHERE service_id=$1`;
  return db.result(sql, [serviceId]);
};

/**
 * Update service_config row
 * @returns {Promise<pgPromise.IResultExt>}
 */
export const updateServiceConfig = ({
  serviceId,
  checkInterval,
  scheduledRunInterval,
  scheduledRunLimit,
  scheduledRunsEnabled,
}) => {
  const serviceConfig = snakecaseKeys({
    checkInterval,
    scheduledRunInterval,
    scheduledRunLimit,
    scheduledRunsEnabled,
  });
  const sql = `${generateUpdate(serviceConfig, 'service_config')} WHERE service_id=$1`;
  return db.result(sql, [serviceId]);
};

/**
 * Get all service configs
 * @returns {Promise<any[]>}
 */
export const getServiceConfigs = () => {
  const sql = 'SELECT * FROM service_config';
  return db.many(sql);
};

