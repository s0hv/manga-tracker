export const getOptionalNumberParam = (value, defaultValue, paramName='Value') => {
  if (value === undefined) {
    return defaultValue;
  }
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new TypeError(`${paramName} value ${value} is not a number`);
  }
  return val;
};

export const regenerateSession = async (req) => {
  const tempSess = req.session;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        // Copy old data to new session
        Object.assign(req.session, tempSess);
        resolve();
      }
    });
  });
};

/**
 * Filter out keys from an object
 *
 * @param {Object} o Object
 * @param {String[]} keys Key that the object is allowed to have
 * @param {Boolean} filterUndefined Whether to filter out undefined values or not
 * @returns {Object} Output object with filtered properties

module.exports.filterProperties = (o, keys, filterUndefined = true) => {
  const keySet = new Set(keys);

  return Object.keys(o)
    .filter(k => keySet.has(k) && (!filterUndefined || o[k] !== undefined))
    .reduce((out, k) => {
      out[k] = o[k];
      return out;
    }, {});
};
*/
