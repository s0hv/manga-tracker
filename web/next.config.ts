import type { NextConfig } from 'next';

export default async (phase: string, { defaultConfig }: { defaultConfig: NextConfig }) => {
  /** @type {import('next').NextConfig} */
  const conf: NextConfig = {
    poweredByHeader: false,
    reactStrictMode: true,
    images: {
      remotePatterns: [new URL('https://uploads.mangadex.org/**')],
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
    transpilePackages: [
      'frappe-charts',
      'react-frappe-charts',
      'swagger-jsdoc',
      '@uiw/react-codemirror',
    ],
  };

  if (/true|y|yes/i.test(process.env.CYPRESS || '')) {
    conf.experimental = {
      swcPlugins: [
        ['swc-plugin-coverage-instrument', {}],
      ],
    };
  }

  if (process.env.ANALYZE) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
      enabled: process.env.ANALYZE === 'true',
    });

    return withBundleAnalyzer(conf);
  }

  return conf;
};
