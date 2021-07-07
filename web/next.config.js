const withTM = require('next-transpile-modules')(['frappe-charts', 'react-frappe-charts', 'swagger-jsdoc']);

module.exports = (phase, { defaultConfig }) => {
  const conf = withTM({
    ...defaultConfig,
    webpack(config) {
      if (config.resolve.fallback) {
        config.resolve.fallback.fs = false;
      }
      return defaultConfig.webpack ? defaultConfig.webpack(config) : config;
    },
    poweredByHeader: false,
    reactStrictMode: true,
    images: {
      domains: ['uploads.mangadex.org'],
      deviceSizes: [300, 600, 960],
      imageSizes: [128, 192, 256, 512],
    },
    async rewrites() {
      return [
        {
          source: '/api',
          destination: '/swagger',
        },
      ];
    },
    eslint: {
      // ESLint not in production dependencies
      ignoreDuringBuilds: true,
    },
  });

  if (process.env.ANALYZE) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: process.env.ANALYZE === 'true',
    });

    return withBundleAnalyzer(conf);
  }

  return conf;
};
