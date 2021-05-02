const { generateUpdate } = require('./utils');
const { db } = require('.');

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
