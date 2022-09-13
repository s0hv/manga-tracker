import {
  FOREIGN_KEY_VIOLATION,
  IN_FAILED_SQL_TRANSACTION,
  INVALID_TEXT_REPRESENTATION,
  NOT_NULL_VIOLATION,
  NUMERIC_VALUE_OUT_OF_RANGE,
  UNIQUE_VIOLATION,
} from 'pg-error-constants';
import type { Response } from 'express-serve-static-core';

import { NoColumnsError } from './errors';
import { dbLogger } from '../utils/logging.js';
import { StatusError } from '../utils/errors.js';
import type { Db } from '.';

/**
 * Generate update statement from an object while filtering out undefined values.
 * Do not pass untrusted properties to this method, as it will update every column given to it
 * @param {Object} o Input object
 * @param {Db} sql Database instance
 */
export const generateUpdate = (o: any, sql: Db) => {
  const obj = { ...o };
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);

  if (Object.keys(obj).length === 0) throw new NoColumnsError('No valid columns given');

  return sql(obj);
};

export function handleError(err: any, res: Response, msgOverrides: any = {}) {
  if (typeof err?.getErrors === 'function') {
    err = err.getErrors().filter((e: any) => e?.code !== IN_FAILED_SQL_TRANSACTION)[0] || err;
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
