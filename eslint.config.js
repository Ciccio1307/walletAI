import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/'] },

  js.configs.recommended,

  // Backend, tests and tooling: Node environment.
  {
    files: ['server/**/*.js', 'tests/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // e2e callbacks passed to page.evaluate() run inside the browser.
  {
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Frontend: browser + React.
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // No PropTypes/TypeScript in this project.
      'react/prop-types': 'off',
      // Apostrophes are everywhere in Italian copy ("dell'AI", "l'app").
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },

  {
    rules: {
      // Destructuring to drop fields (e.g. password_hash) is intentional.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
];
