const format = require('pg-format');
const {
  NUMERIC_VALUE_OUT_OF_RANGE,
  INVALID_TEXT_REPRESENTATION,
  UNIQUE_VIOLATION,
} = require('pg-error-constants');
const dblog = require('debug')('db');

function generateEqualsColumns(o, availableColumns) {
  const cols = new Set(availableColumns);
  const sqlValues = [];
  const columns = [];
  const args = [];

  Object.keys(o)
    .filter(k => o[k] !== undefined && cols.has(k))
    .forEach((k, idx) => {
      sqlValues.push(`%I=$${idx+1}`);
      columns.push(k);
      args.push(o[k]);
    });

  const sqlCols = format(sqlValues.join(','), ...columns);

  return { sqlCols, args };
}
module.exports.generateEqualsColumns = generateEqualsColumns;

function handleError(err, res, msgOverrides = {}) {
  const msg = msgOverrides[err.code];
  if (err.code === INVALID_TEXT_REPRESENTATION) {
    dblog(err.message);
    res.status(400).json({ error: msg || 'Invalid data type given' });
  } else if (err.code === NUMERIC_VALUE_OUT_OF_RANGE) {
    res.status(400).json({ error: msg || 'Number value out of range' });
  } else if (err.code === UNIQUE_VIOLATION) {
    res.status(422).json({ error: msg || 'Resource already exists' });
  } else {
    dblog(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
module.exports.handleError = handleError;
