import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.buyer-arena/**',
      'coverage/**',
      'examples/demo-output/**',
      '.tmp/**',
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
        Intl: 'readonly',
        setTimeout: 'readonly',
      },
    },
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
