export default async function stopServer(httpServer) {
  console.log('Closing server');
  const { pgp } = require('../db');
  let elasticsearch = require('../db/elasticsearch');
  if (elasticsearch.default) {
    elasticsearch = elasticsearch.default;
  }
  await new Promise(resolve => httpServer.close(resolve));
  const { redis } = require('../utils/ratelimits');
  redis.disconnect();

  await pgp.end();
  await elasticsearch.close();
  jest.clearAllTimers();
}
