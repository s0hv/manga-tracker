const format = require('pg-format');
const dblog = require('debug')('db');

function generateEqualsColumns(o, availableColumns) {
  const cols = new Set(availableColumns);
  const sqlValues = [];
  const columns = [];
  const args = [];

  Object.keys(o)
    .filter(k => cols.has(k))
    .forEach((k, idx) => {
      sqlValues.push(`%I=$${idx+1}`);
      columns.push(k);
      args.push(o[k]);
    });

  const sqlCols = format(sqlValues.join(','), ...columns);

  return { sqlCols, args };
}
module.exports.generateEqualsColumns = generateEqualsColumns;

function handleError(err, res) {
  if (err.code === '22P02') {
    dblog(err.message);
    res.status(400).json({ error: 'Invalid data type given' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
module.exports.handleError = handleError;
