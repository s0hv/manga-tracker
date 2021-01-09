const { Pool } = require('pg');

const isTest = process.env.NODE_ENV === 'test';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: isTest ?
    process.env.DB_NAME_TEST || process.env.DB_NAME :
    process.env.DB_NAME,
  port: process.env.DB_PORT,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

function query(sql, args) {
  return pool.query(sql, args);
}

module.exports = {
  pool,
  query,
};
