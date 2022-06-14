import createCache from '@emotion/cache';

export default function createEmotionCache() {
  // createCache export is different for browser and server.
  // This is to workaround for the fact that the method lives in the default property
  // on the server.
  const fn = typeof createCache.default === 'function' ? createCache.default : createCache;
  return fn({ key: 'css', prepend: true });
}
