import Redis from 'ioredis';
import {
  type IRateLimiterRedisOptions,
  RateLimiterMemory,
  RateLimiterRedis,
} from 'rate-limiter-flexible';
import type {
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';
import { createSingleton } from '@/serverUtils/utilities';

export const redis = createSingleton<Redis>('redisClient', () => new Redis(process.env.REDIS_URL!, {
  enableOfflineQueue: process.env.NODE_ENV !== 'production',
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  retryStrategy: (times) => {
    if (times > 3) {
      return null;
    }
    return 200;
  },
}));

redis.on('error', err => {
  console.error('Redis error', err);
});

const rateLimiterMemory = new RateLimiterMemory({
  points: 60, // 300 / 5 if there are 5 processes at all
  duration: 60,
});

const rateLimitOpts: IRateLimiterRedisOptions = {
  storeClient: redis,
  points: 300,
  duration: 60,

  execEvenly: false,
  keyPrefix: 'rlflx',
  inMemoryBlockOnConsumed: 300,
  inMemoryBlockDuration: 60,
  insuranceLimiter: rateLimiterMemory,
};

export const mangadexLimiter = new RateLimiterMemory({
  points: 4,
  duration: 1,
});

const accountLoginRetries = Number.parseInt(process.env.LOGIN_RETRY_COUNT || '10', 10);

export const limiterSlowBruteByIP = createSingleton('bruteforceByIp', () => new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'login_fail_ip_per_day',
  points: Number.isFinite(accountLoginRetries) ? accountLoginRetries : 10, // email + password logins are not possible to register so a low limit is fine.
  duration: 24 * 60 * 60, // 1 day
  blockDuration: 24 * 60 * 60, // 1 day
}));

const rateLimiterRedis = new RateLimiterRedis(rateLimitOpts);

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.session.userId ?? req.ip;
  const pointsToConsume = req.session?.userId ? 1 : 3;
  rateLimiterRedis.consume(key, pointsToConsume)
    .then(() => next())
    .catch(() => {
      res.status(429).send('Too Many Requests');
    });
};
