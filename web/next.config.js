import withTmInitializer from 'next-transpile-modules';

const withTM = withTmInitializer(([
  'frappe-charts',
  'react-frappe-charts',
  'swagger-jsdoc',
]));

export default async (phase, { defaultConfig }) => {
  const conf = withTM({
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
    compiler: {
      emotion: true,
    },
    experimental: {
      modularizeImports: {
        '@mui/material': {
          transform: '@mui/material/{{member}}',
        },
        '@mui/icons-material': {
          transform: '@mui/icons-material/{{member}}',
        },
      },
    },
    swcMinify: false,
  });

  if (process.env.ANALYZE) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
      enabled: process.env.ANALYZE === 'true',
    });

    return withBundleAnalyzer(conf);
  }

  return conf;
};
