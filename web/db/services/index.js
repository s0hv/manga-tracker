const snakecaseKeys = require('snakecase-keys');

const { generateUpdate } = require('../utils');
const { db } = require('..');

const getService = (serviceId) => db.oneOrNone('SELECT * FROM services WHERE service_id=$1', [serviceId]);
module.exports.getService = getService;

const getServiceWhole = (serviceId) => db.oneOrNone('SELECT * FROM service_whole WHERE service_id=$1', [serviceId]);
module.exports.getServiceWhole = getServiceWhole;

const getServiceConfig = (serviceId) => db.oneOrNone('SELECT * FROM service_config WHERE service_id=$1', [serviceId]);
module.exports.getServiceConfig = getServiceConfig;

module.exports.getServiceFull = (serviceId) => {
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
module.exports.updateService = ({
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
module.exports.updateServiceWhole = ({
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
module.exports.updateServiceConfig = ({
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
module.exports.getServiceConfigs = () => {
  const sql = 'SELECT * FROM service_config';
  return db.many(sql);
};

