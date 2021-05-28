export default async (httpServer) => {
  console.log('Closing server');
  const { pgp } = require('../db');
  const elasticsearch = require('../db/elasticsearch');
  await new Promise(resolve => httpServer.close(resolve));
  const { redis } = require('../utils/ratelimits');
  redis.disconnect();

  await pgp.end();
  await elasticsearch.close();
  jest.clearAllTimers();
};
