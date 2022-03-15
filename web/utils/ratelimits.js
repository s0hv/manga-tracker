const Redis = require('ioredis');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const ExpressBruteFlexible = require('rate-limiter-flexible/lib/ExpressBruteFlexible');

const redis = new Redis(process.env.REDIS_URL, {
  enableOfflineQueue: process.env.NODE_ENV !== 'production',
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  retryStrategy: (times) => {
    if (times > 3) {
      return new Error('Redis offline');
    }
    return 200;
  },
});

redis.on('error', err => {
  console.error('Redis error', err);
});

const rateLimiterMemory = new RateLimiterMemory({
  points: 60, // 300 / 5 if there are 5 processes at all
  duration: 60,
});

const rateLimitOpts = {
  storeClient: redis,
  points: 300,
  duration: 60,

  execEvenly: false,
  keyPrefix: 'rlflx',
  inmemoryBlockOnConsumed: 300,
  inmemoryBlockDuration: 60,
  insuranceLimiter: rateLimiterMemory,
};

const bruteOpts = {
  freeRetries: 10,
  minWait: 1000, // 1 second
  maxWait: 50000, // 50 seconds
  lifetime: 100, // 100 seconds
  storeClient: redis,
  keyPrefix: 'brtfrc',
};

const mangadexLimiter = new RateLimiterMemory({
  points: 4,
  duration: 1,
});

module.exports.mangadexLimiter = mangadexLimiter;

const bruteforce = new ExpressBruteFlexible(
  ExpressBruteFlexible.LIMITER_TYPES.REDIS,
  bruteOpts
);

const rateLimiterRedis = new RateLimiterRedis(rateLimitOpts);

const rateLimiter = (req, res, next) => {
  const key = req.session ? req.session.userId : req.ip;
  const pointsToConsume = req.session.userId ? 1 : 3;
  rateLimiterRedis.consume(key, pointsToConsume)
    .then(() => next())
    .catch(() => {
      res.status(429).send('Too Many Requests');
    });
};

module.exports.bruteforce = bruteforce;
module.exports.rateLimiter = rateLimiter;
module.exports.redis = redis;
