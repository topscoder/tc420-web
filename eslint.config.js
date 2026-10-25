import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'PLed/', 'tc420-main/', 'test-results/', 'playwright-report/', 'docs/design/', '_site/'],
  },
  js.configs.recommended,
  {
    files: ['webapp/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['webapp/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
