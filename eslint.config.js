import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'PLed/', 'tc420-main/', 'test-results/', 'playwright-report/', 'docs/design/'],
  },
  js.configs.recommended,
  {
    files: ['webapp/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
