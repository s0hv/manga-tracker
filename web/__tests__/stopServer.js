export default async (httpServer) => {
  console.log('Closing server');
  const { redis } = require('../utils/ratelimits');
  const { pool } = require('../db');
  const elasticsearch = require('../db/elasticsearch');
  await new Promise(resolve => httpServer.close(resolve));
  redis.disconnect();
  await pool.end();
  await elasticsearch.close();
};
