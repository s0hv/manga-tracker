const getOptionalNumberValue = (value, defaultValue, paramName='Value') => {
  if (value === undefined) {
    return defaultValue;
  }
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new TypeError(`${paramName} value ${value} is not a number`);
  }
  return val;
};
module.exports.getOptionalNumberParam = getOptionalNumberValue;

const regenerateSession = async (req) => {
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
module.exports.regenerateSession = regenerateSession;

/**
 * Filter out keys from an object
 *
 * @param {Object} o Object
 * @param {String[]} keys Key that the object is allowed to have
 * @param {Boolean} filterUndefined Whether to filter out undefined values or not
 * @returns {Object} Output object with filtered properties
 */
module.exports.filterProperties = (o, keys, filterUndefined = true) => {
  const keySet = new Set(keys);

  return Object.keys(o)
    .filter(k => keySet.has(k) && (!filterUndefined || o[k] !== undefined))
    .reduce((out, k) => {
      out[k] = o[k];
      return out;
    }, {});
};

/**
 * Turns snake_case string into camelCase
 * @param {String} s
 */
const underscoreToCamelCase = (s) => s.replace(/(_[a-z])/g, letter => letter[1].toUpperCase());

/**
 * Makes object keys camelCase instead of snake_case
 * @param o
 * @returns {Object} camelCase object
 */
module.exports.snakeCaseToCamelCase = (o) => Object.keys(o)
  .reduce((out, key) => {
    out[underscoreToCamelCase(key)] = o[key];
    return out;
  }, {});
