// @ts-check

import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import stylistic from '@stylistic/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
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
  ],
  pathGroupsExcludedImportTypes: ['builtin', 'object'],
  distinctGroup: false,
  'newlines-between': 'always',
  named: {
    enabled: true,
    types: 'types-first',
  },
};

export default tseslint.config(
  // ignores must be the only property in the object
  {
    ignores: ['public/*', '__mocks__/*', 'dist/*', 'instrumented/*', '.*/*'],
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
  tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  stylistic.configs.recommended,
  nextPlugin.flatConfig.recommended,
  reactHooks.configs['recommended-latest'],
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
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // Code style
      '@stylistic/semi': ['error', 'always', { omitLastInOneLineBlock: true }],
      '@stylistic/quotes': ['error', 'single', {
        avoidEscape: true,
        allowTemplateLiterals: true,
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
        ignoreRestSiblings: true,
      }],
      '@stylistic/function-paren-newline': ['error', 'consistent'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'none',
            requireLast: false,
          },
          singleline: {
            delimiter: 'comma',
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

      // TODO temporarily off
      '@typescript-eslint/no-explicit-any': 'off',

      // React
      'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx']}],
      'react/function-component-definition': 'off',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'import/order': [
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
      'import/no-extraneous-dependencies': ['error', {
        devDependencies: [
          '**/__tests__/**/*',
          '**/__tests__/**',
          '__mocks__/**',
          '**/setupTests.ts',
          'vitest.config.ts',
          'cypress.config.ts',
          'eslint.config.mjs',
          'cypress/**',
          './cypress/support/e2e.ts',
          'loader.js',
        ]}],

      // Disabled rules
      '@next/next/no-img-element': 'off',
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

      'import/order': [
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
    },
  }
);
