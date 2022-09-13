export default async function stopServer(httpServer) {
  console.log('Closing server');
  const { db } = require('../db');
  let elasticsearch = require('../db/elasticsearch');
  if (elasticsearch.default) {
    elasticsearch = elasticsearch.default;
  }
  await new Promise(resolve => httpServer.close(resolve));
  const { redis } = require('../utils/ratelimits');
  redis.disconnect();

  await db.end({ timeout: 5 });
  await elasticsearch.close();
  jest.clearAllTimers();
}
