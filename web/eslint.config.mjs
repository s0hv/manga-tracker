// @ts-check

import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import stylistic from '@stylistic/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['public/*', '__mocks__/*', 'dist/*', 'instrumented/*'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  stylistic.configs.recommended,
  nextPlugin.flatConfig.recommended,
  {
    plugins: {
      react,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: [
            './tsconfig.json',
            './__tests__/tsconfig.json',
            './cypress/tsconfig.json',
            './tsconfig.server.json',
          ],
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
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/comma-dangle': ['warn', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      }],
      '@stylistic/object-curly-spacing': ['warn', 'always', {
        arraysInObjects: false,
        objectsInObjects: false,
      }],
      '@stylistic/operator-linebreak': ['warn', 'after'],
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@stylistic/function-paren-newline': ['error', 'consistent'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/quote-props': ['error', 'as-needed'],

      // React
      'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx']}],
      'react/function-component-definition': 'off',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'import/order': [
        'error',
        {
          groups: [
            ['builtin'],
            ['external'],
            ['internal', 'unknown'],
            ['parent'],
            ['sibling', 'index'],
          ],
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            {
              // Minimatch pattern used to match against specifiers
              pattern: 'react',
              // The predefined group this PathGroup is defined in relation to
              group: 'external',
              // How matching imports will be positioned relative to "group"
              position: 'before',
            },
            {
              // Minimatch pattern used to match against specifiers
              pattern: '@mui/**',
              // The predefined group this PathGroup is defined in relation to
              group: 'external',
              // How matching imports will be positioned relative to "group"
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
        },
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
          '**/setupTests.ts',
          'vitest.config.ts',
          'cypress.config.ts',
          'eslint.config.mjs',
          'cypress/**',
          './cypress/support/e2e.ts',
          'loader.js',
        ]}],
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
      'vitest/no-large-snapshots': ['warn', { maxSize: 15 }],
      'vitest/expect-expect': ['warn', {
        assertFunctionNames: ['expect', 'expect*', 'assert*', 'request.**.expect', 'agent.**.expect'],
      }],
    },
  }
);
