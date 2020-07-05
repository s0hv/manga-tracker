module.exports = (phase, { defaultConfig }) => {
  const conf = {
    ...defaultConfig,
    poweredByHeader: false,
  };

  if (process.env.ANALYZE) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: process.env.ANALYZE === 'true',
    });

    return withBundleAnalyzer(conf);
  }

  return conf;
};
