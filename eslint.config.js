import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'build/**',
      'data/**',
      'dist/**',
      'assets/**/*.svg',
      'profile-3d-contrib/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    files: ['scripts/**/*.js', 'src/cli/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
];
