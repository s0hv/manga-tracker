module.exports = {
  "extends": [
    "next",
    "airbnb",
    "plugin:react/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:jsx-a11y/recommended",
    "plugin:jest/style"
  ],
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["react", "jest", "import-newlines"],
  "rules": {
    "semi": ["warn", "always", {"omitLastInOneLineBlock": true}],
    "quotes": ["warn", "single", {
      "avoidEscape": true,
      "allowTemplateLiterals": true
    }],
    "jsx-quotes": ["error", "prefer-single"],
    "linebreak-style": "off",
    "no-multiple-empty-lines": "off",
    "no-underscore-dangle": "off",
    "comma-dangle": ["warn", {
      "arrays": "always-multiline",
      "objects": "always-multiline",
      "imports": "always-multiline",
      "exports": "always-multiline",
      "functions": "never"
    }],
    "react/jsx-filename-extension": [1, { "extensions": [".jsx", ".tsx"] }],
    "object-curly-spacing": ["warn", "always", {
      "arraysInObjects":  false,
      "objectsInObjects":  false
    }],
    "operator-linebreak": ["warn", "after"],
    "jest/no-large-snapshots": ["warn", { "maxSize":  15 }],
    "jest/expect-expect": ["warn", {
      "assertFunctionNames": ["expect", "expect*", "assert*", "request.**.expect"]
    }],
    "no-unused-vars": ["warn", {
      "argsIgnorePattern":  "^_",
      "ignoreRestSiblings": true
    }],
    "react/function-component-definition": "off",
    "function-paren-newline": ["error", "consistent"],
    "react/no-unstable-nested-components": ["error", { "allowAsProps":  true }],
    "import-newlines/enforce": ["error", { "items": 5, "max-len": 80 }],
    "import/order": [
      "error",
      {
        "groups": [
          ["builtin", "external"],
          ["internal", "unknown", "parent", "sibling", "index"]
        ],
        "alphabetize": { "order": "ignore", "caseInsensitive": true }
      }
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
        '**/setupTests.ts',
        'vitest.config.ts',
        'loader.js',
      ]}],


    "prefer-template": "off",
    "arrow-parens": "off",
    "no-console": "off",
    "object-curly-newline": "off",
    "prefer-promise-reject-errors": "off",
    "consistent-return": "off",
    "radix": "off",
    "space-infix-ops": "off",
    "no-plusplus": "off",
    "no-param-reassign": "off",
    "object-shorthand": "off",
    "max-len": "off",
    "no-inner-declarations": "off",
    "react/require-default-props": "off",
    "react/jsx-props-no-spreading": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "react/jsx-one-expression-per-line": "off",
    "react/jsx-fragments": "off",
    "react/prop-types": "off",
    "prefer-destructuring": "off",
    "global-require": "off",
    "prefer-default-export": "off",
    "import/prefer-default-export": "off",
    "react/jsx-key": "off",
    "no-unused-expressions": "off",
    "react/display-name": "off",
    "max-classes-per-file": "off",
    "react/forbid-prop-types": "off",
    "no-promise-executor-return": "off",
    "import/extensions": "off",
    "arrow-body-style": "off",
    "lines-between-class-members": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "react/destructuring-assignment": "off",
  },
  "env": {
    "browser": true,
    "node": true,
    "jest": true,
    "es2020": true
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "globals": {
    "React": "writable"
  },
  "ignorePatterns": [".*", "public/*", "__mocks__/*", "dist/*"],
  "overrides": [
    {
      "files": ["**/*.ts", "**/*.tsx"],
      "plugins": [
        "react",
        "jest",
        "@typescript-eslint"
      ],
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
        "tsconfigRootDir": __dirname,
        "project": ['./tsconfig.json'],
      },
      "globals": {
        "NodeJS": true
      },
      "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
      ],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-empty-function": "off",
        "no-shadow": "off",
        "@typescript-eslint/no-shadow": "error",
        "@typescript-eslint/ban-ts-comment": ["error", {
          "ts-expect-error": false
        }],
        '@typescript-eslint/no-unused-vars': [
          "warn", {
            "argsIgnorePattern":  "^_",
            "ignoreRestSiblings": true
          }
        ],
        "@typescript-eslint/no-non-null-assertion": "off"
      },
      "settings": {
        "import/parsers": {
          "@typescript-eslint/parser": [".ts", ".tsx"]
        }
      }
    }
  ]
}
