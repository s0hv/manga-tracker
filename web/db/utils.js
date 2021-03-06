const {
  NUMERIC_VALUE_OUT_OF_RANGE,
  INVALID_TEXT_REPRESENTATION,
  UNIQUE_VIOLATION,
} = require('pg-error-constants');

const { pgp } = require('./index');
const { NoColumnsError } = require('./errors');
const { dbLogger } = require('../utils/logging');

/**
 * Generate update statement from an object while filtering out undefined values.
 * The generated update statement lacks a WHERE clause and has the values embedded in the query.
 * @param {Object} o Input object
 * @param {String} tableName Name of the table to be updated
 * @returns {String} The update statement without a whereclause
 */
module.exports.generateUpdate = (o, tableName) => {
  const obj = { ...o };
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
  try {
    return pgp.helpers.update(obj, null, tableName);
  } catch (e) {
    throw new NoColumnsError('No valid columns given');
  }
};

function handleError(err, res, msgOverrides = {}) {
  const msg = msgOverrides[err.code];
  if (err.code === INVALID_TEXT_REPRESENTATION) {
    dbLogger.debug(err.message);
    res.status(400).json({ error: msg || 'Invalid data type given' });
  } else if (err.code === NUMERIC_VALUE_OUT_OF_RANGE) {
    res.status(400).json({ error: msg || 'Number value out of range' });
  } else if (err.code === UNIQUE_VIOLATION) {
    res.status(422).json({ error: msg || 'Resource already exists' });
  } else {
    dbLogger.error(err, 'Unknown database error');
    res.status(500).json({ error: 'Internal server error' });
  }
}
module.exports.handleError = handleError;
