const isTest = process.env.NODE_ENV === 'test';

const pgp = require('pg-promise')({
  noLocking: isTest,
  capSQL: true,
  pgFormatting: true,
});

// Will cause warnings when in development mode
const db = pgp({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: isTest ?
    process.env.DB_NAME_TEST || process.env.DB_NAME :
    process.env.DB_NAME,
  port: process.env.DB_PORT,
  password: process.env.PGPASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

function query(sql, args) {
  return db.query(sql, args);
}

async function end() {
  await pgp.end();
}

module.exports = {
  query,
  db,
  pgp,
  end,
};
