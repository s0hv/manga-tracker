const nextJest = require('next/jest');

const baseConfig = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],

  testPathIgnorePatterns: ['/node_modules/', '/.next/', '<rootDir>/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/node_modules/babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-frappe-charts|frappe-charts|swagger-jsdoc|jsonpath-plus|react-colorful|yaml|camelcase-keys|camelcase|quick-lru)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '<rootDir>/node_modules/react-frappe-charts': 'react-frappe-charts',
    '<rootDir>/node_modules/swagger-jsdoc': 'swagger-jsdoc',

    // Module aliases
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/views/(.*)$': '<rootDir>/src/views/$1',
    '^@/webUtils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/serverUtils/(.*)$': '<rootDir>/utils/$1',
    '^@/db/(.*)$': '<rootDir>/db/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/common/(.*)$': '<rootDir>/common/$1',
  },
};

// Config that cannot be project specific
const globalConfig = {
    // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.config.js',
    '!**/utils/logging.js', // No need to collect coverage for loggers
    '!**/{setupTests,next.config,babel.config,loader,.eslintrc}.{js,ts,cjs}', // test setup and app configs
  ],
  reporters: ['default', 'github-actions'],
}

const createJestConfig = nextJest();

module.exports = async () => {
  const config = await createJestConfig(baseConfig)();
  return {
    ...globalConfig,
    projects: [
      {
        ...config,
        displayName: 'frontend',
        testEnvironment: 'jsdom',
        testMatch: [
          '<rootDir>/__tests__/**/*.test.[jt]sx',
        ],
        // Some modules need transform
        transformIgnorePatterns: baseConfig.transformIgnorePatterns
      },
      {
          ...config,
          transformIgnorePatterns: baseConfig.transformIgnorePatterns,
          displayName: 'backend',
          testEnvironment: 'node',
          testMatch: [
            '<rootDir>/__tests__/**/*.test.[jt]s',
          ],
      }
    ],
  };
};
