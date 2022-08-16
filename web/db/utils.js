import {
  NUMERIC_VALUE_OUT_OF_RANGE,
  INVALID_TEXT_REPRESENTATION,
  UNIQUE_VIOLATION,
  IN_FAILED_SQL_TRANSACTION,
  FOREIGN_KEY_VIOLATION,
  NOT_NULL_VIOLATION,
} from 'pg-error-constants';

import { pgp } from '.';
import { NoColumnsError } from './errors.js';
import { dbLogger } from '../utils/logging.js';
import { StatusError } from '../utils/errors.js';

/**
 * Generate update statement from an object while filtering out undefined values.
 * The generated update statement lacks a WHERE clause and has the values embedded in the query.
 * @param {Object} o Input object
 * @param {String} tableName Name of the table to be updated
 * @returns {String} The update statement without a whereclause
 */
export const generateUpdate = (o, tableName) => {
  const obj = { ...o };
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
  try {
    return pgp.helpers.update(obj, null, tableName);
  } catch (e) {
    throw new NoColumnsError('No valid columns given');
  }
};

export function handleError(err, res, msgOverrides = {}) {
  if (typeof err?.getErrors === 'function') {
    err = err.getErrors().filter(e => e?.code !== IN_FAILED_SQL_TRANSACTION)[0] || err;
  }

  if (err instanceof StatusError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof NoColumnsError) {
    res.status(400).json({ error: err.message || 'No valid columns given' });
    return;
  }

  const msg = msgOverrides[err.code];
  if (err.code === INVALID_TEXT_REPRESENTATION) {
    dbLogger.debug(err.message);
    res.status(400).json({ error: msg || 'Invalid data type given' });
  } else if (err.code === NUMERIC_VALUE_OUT_OF_RANGE) {
    res.status(400).json({ error: msg || 'Number value out of range' });
  } else if (err.code === UNIQUE_VIOLATION) {
    res.status(422).json({ error: msg || 'Resource already exists' });
  } else if (err.code === FOREIGN_KEY_VIOLATION) {
    res.status(404).json({ error: msg || 'Foreign key violation' });
  } else if (err.code === NOT_NULL_VIOLATION) {
    res.status(400).json({ error: msg || 'Not null value was null' });
  } else {
    dbLogger.error(err, 'Unknown database error');
    res.status(500).json({ error: msg || 'Internal server error' });
  }
}
