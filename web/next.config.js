const withTM = require('next-transpile-modules')(['frappe-charts']);

module.exports = (phase, { defaultConfig }) => {
  const conf = withTM({
    ...defaultConfig,
    poweredByHeader: false,
    reactStrictMode: true,
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
