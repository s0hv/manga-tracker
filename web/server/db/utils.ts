import { isPlainObject } from 'es-toolkit';
import type { Response } from 'express-serve-static-core';
import {
  type SqlToken,
  ForeignKeyIntegrityConstraintViolationError,
  InvalidInputError,
  NotNullIntegrityConstraintViolationError,
  SlonikError,
  UniqueIntegrityConstraintViolationError,
} from 'slonik';
import snakecaseKeys from 'snakecase-keys';

import { sql } from './index';
import { StatusError } from '../utils/errors';
import { dbLogger, expressLogger } from '../utils/logging';

import { NoColumnsError } from './errors';

const withoutUndefined = (o: Record<string, unknown>) => {
  const obj = { ...o };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);

  return obj;
};

function getValueAsSql(value: unknown): SqlToken {
  if (value instanceof Date) {
    return sql.timestamp(value);
  }

  // Only plain objects should be treated as JSON
  if (isPlainObject(value)) {
    // All slonik SQL tokens have the type property, which is a symbol.
    // If the value already is an SQL token, return it as is.
    if ('type' in value && typeof value.type === 'symbol') {
      return value as SqlToken;
    }

    return sql.json(value);
  }

  return sql.fragment`${value as never}`;
}

/**
 * Builds a `(col1, col2) VALUES (val1, val2)` fragment from an object, filtering out undefined
 * values. Do not pass untrusted properties to this method, as it will insert every column given to it.
 */
export const insertValues = (o: Record<string, unknown>): SqlToken => {
  const entries = Object.entries(snakecaseKeys(withoutUndefined(o), { deep: false }));

  if (entries.length === 0) {
    throw new NoColumnsError('No valid columns given');
  }

  const columns = sql.join(entries.map(([column]) => sql.identifier([column])), sql.fragment`, `);
  const values = sql.join(
    entries.map(([, value]) => getValueAsSql(value)),
    sql.fragment`, `
  );

  return sql.fragment`(${columns}) VALUES (${values})`;
};

/**
 * Builds a `col1 = val1, col2 = val2` SET fragment from an object, filtering out undefined values.
 * Do not pass untrusted properties to this method, as it will update every column given to it.
 */
export const updateSet = (o: Record<string, unknown>): SqlToken => {
  const entries = Object.entries(snakecaseKeys(withoutUndefined(o), { deep: false }));

  if (entries.length === 0) {
    throw new NoColumnsError('No valid columns given');
  }

  return sql.join(
    entries.map(([column, value]) => sql.fragment`${sql.identifier([column])} = ${getValueAsSql(value)}`),
    sql.fragment`, `
  );
};

export function handleError(err: unknown, res: Response, msgOverrides: Record<string, string> = {}) {
  if (err instanceof StatusError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof NoColumnsError) {
    res.status(400).json({ error: err.message || 'No valid columns given' });
    return;
  }

  if (err instanceof UniqueIntegrityConstraintViolationError) {
    res.status(422).json({ error: msgOverrides.uniqueViolation || 'Resource already exists' });
    return;
  }

  if (err instanceof ForeignKeyIntegrityConstraintViolationError) {
    res.status(404).json({ error: msgOverrides.foreignKeyViolation || 'Foreign key violation' });
    return;
  }

  if (err instanceof NotNullIntegrityConstraintViolationError) {
    res.status(400).json({ error: msgOverrides.notNullViolation || 'Not null value was null' });
    return;
  }

  if (err instanceof InvalidInputError) {
    dbLogger.debug(err.message);
    res.status(400).json({ error: msgOverrides.invalidInput || 'Invalid data type given' });
    return;
  }

  if (err instanceof SlonikError) {
    dbLogger.error(err, 'Unknown database error');
    res.status(500).json({ error: msgOverrides.unknown || 'Internal server error' });
    return;
  }

  expressLogger.error(err, 'Unknown error');
  res.status(500).json({ error: 'Internal server error' });
}
