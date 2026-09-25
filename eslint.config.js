import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.buyer-arena/**',
      'coverage/**',
      'examples/demo-output/**',
      '.tmp/**',
      'site-dist/**',
      'out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/reports/assets/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        matchMedia: 'readonly',
        requestAnimationFrame: 'readonly',
        addEventListener: 'readonly',
        innerHeight: 'readonly',
        innerWidth: 'readonly',
        location: 'readonly',
        URLSearchParams: 'readonly',
        getComputedStyle: 'readonly',
        Blob: 'readonly',
        Image: 'readonly',
        XMLSerializer: 'readonly',
        history: 'readonly',
        Intl: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    // Official site: browser script plus Node build/QA scripts. Non-breaking spaces in copy are intentional.
    files: ['site/**/*.{js,mjs}', 'scripts/build-site.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }] },
  },
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
