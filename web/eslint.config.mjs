// @ts-check

import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import importZod from 'eslint-plugin-import-zod';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';


const importOrderBase = {
  groups: [
    ['builtin', 'unknown'],
    ['external'],
    ['internal'],
    ['parent', 'index'],
    ['sibling'],
    ['object'],
  ],
  alphabetize: { order: 'asc', caseInsensitive: true },
  pathGroups: [
    {
      // React imports should be first
      pattern: 'react',
      group: 'external',
      position: 'before',
    },
    {
      // Mui imports should be first
      pattern: '@mui/**',
      group: 'external',
      position: 'before',
    },
    {
      pattern: '**/*.svg',
      group: 'object',
      position: 'after',
    },
  ],
  pathGroupsExcludedImportTypes: ['builtin'],
  distinctGroup: false,
  'newlines-between': 'always',
  named: {
    enabled: true,
    types: 'types-first',
  },
};

export default defineConfig(
  // ignores must be the only property in the object
  {
    ignores: [
      'public/*',
      '__mocks__/*',
      '**/dist/*',
      'instrumented/*',
      '.*/*',
      'coverage/**',
    ],
  },
  {
    files: [
      '*.m?(t|j)s',
      '__mocks__/*',
      '__tests__/*',
      'common/*',
      'cypress/*',
      'server/*',
      'src/*',
      'swagger/*',
      'types/*',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  stylistic.configs.recommended,
  reactHooks.configs.flat.recommended,
  importZod.configs.recommended,
  {
    plugins: {
      react,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
      },
      parserOptions: {
        projectService: {
          // The project service does not know how to use the server specific tsconfig
          allowDefaultProject: ['server.ts'],
          defaultProject: './tsconfig.server.json',
        },
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '19',
      },
    },
    rules: {
      // Code style
      '@stylistic/semi': ['error', 'always', { omitLastInOneLineBlock: true }],
      '@stylistic/quotes': ['error', 'single', {
        avoidEscape: true,
        allowTemplateLiterals: 'always',
      }],
      '@stylistic/indent': ['error', 2],
      '@stylistic/indent-binary-ops': ['error', 2],
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/comma-dangle': ['error', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      }],
      '@stylistic/object-curly-spacing': ['error', 'always', {
        arraysInObjects: false,
        objectsInObjects: false,
      }],
      '@stylistic/operator-linebreak': ['error', 'before', {
        overrides: {
          '=': 'after',
        },
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/only-throw-error': ['error', {
        allowRethrowing: true,
        allow: [
          {
            from: 'package',
            name: ['NotFoundError', 'Redirect'],
            package: '@tanstack/router-core',
          },
        ],
      }],
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: false,
      }],
      '@typescript-eslint/prefer-nullish-coalescing': ['error', {
        ignorePrimitives: {
          // Boolean coercion is often on purpose when you just want to get
          // the first true value
          boolean: true,
        },
        ignoreIfStatements: true,
      }],
      // I feel like this will more easily cause bugs for record and array access
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // This seemed to just cause too much annoyance
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      // This is used quite a bit in the codebase
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@stylistic/function-paren-newline': ['error', 'consistent'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'semi',
            requireLast: true,
          },
          singleline: {
            delimiter: 'semi',
            requireLast: false,
          },
        },
      ],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
      '@stylistic/block-spacing': 'off',
      '@stylistic/jsx-one-expression-per-line': ['error', {
        allow: 'non-jsx',
      }],
      '@stylistic/object-property-newline': [
        'error',
        { allowAllPropertiesOnSameLine: true },
      ],

      // TODO temporarily off
      '@typescript-eslint/no-explicit-any': 'off',

      // React
      // Disabled as the plugin is not compatible with eslint 10
      'react/jsx-filename-extension': ['off', { extensions: ['.jsx', '.tsx']}],
      'react/function-component-definition': 'off',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'import-x/order': [
        'error',
        importOrderBase,
      ],
      // https://github.com/airbnb/javascript/blob/0b1f62372ee0ce9e228a1a9a98d948d323d1737f/packages/eslint-config-airbnb-base/rules/style.js#L340
      // removed for of loop restriction
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
        },
        {
          selector: 'LabeledStatement',
          message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
      ],
      'import-x/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/__tests__/**/*',
          '**/__tests__/**',
          '__mocks__/**',
          '**/setupTests.ts',
          'vite.config.ts',
          'vitest.config.ts',
          'cypress.config.ts',
          'eslint.config.mjs',
          'cypress/**',
          './cypress/support/e2e.ts',
          'scripts/**',
        ]}],
      'import-x/no-unresolved': ['error', { ignore: ['\\.svg$']}],
      'import-x/no-deprecated': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-named-as-default-member': 'off',

      // No plans on using the compiler in the near future
      'react-hooks/incompatible-library': 'off',
    },
  },

  {
    files: [
      'eslint.config.mjs',
      'vitest.config.ts',
      'setupTests.ts',
      'scripts/**',
    ],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: [
      'cypress/**',
    ],
    rules: {
      // Chained methods must be async in cypress even if there are no awaits in them
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    files: ['src/**/*', 'src/*'],
    rules: {
      'import-x/no-restricted-paths': ['error', {
        zones: [
          {
            target: ['./src', './server', './types'],
            from: ['./__tests__', './__mocks__'],
            message: 'Do not import test files',
          },
          {
            target: ['./src/!(serverFunctions|middleware)/**/*', './src/**.ts'],
            from: ['./server'],
            message: 'Server file imported on the client',
          },
        ],
      }],
    },
  },

  {
    files: ['__tests__/**/*'],
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-large-snapshots': ['error', { maxSize: 15 }],
      'vitest/expect-expect': ['error', {
        assertFunctionNames: ['expect', 'expect*', 'assert*', 'request.**.expect', 'agent.**.expect'],
      }],

      'import-x/order': [
        'error',
        {
          ...importOrderBase,
          pathGroups: [
            ...importOrderBase.pathGroups,
            {
              pattern: '{api-test-utilities,initServer,stopServer,utils,dbutils}',
              group: 'internal',
              position: 'before',
              patternOptions: { matchBase: true },
            },
          ],
        },
      ],

      '@stylistic/max-statements-per-line': ['error', { max: 3 }],

      // Makes some test code a bit tidier
      '@stylistic/jsx-one-expression-per-line': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  }
);
