// @ts-check
require('@rushstack/eslint-patch/modern-module-resolution');
const { defineConfig } = require('eslint-define-config');

module.exports = defineConfig({
  root: true,
  ignorePatterns: ['.eslintrc.cjs'],
  extends: [
    '.eslintrc-auto-import.json',
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
  ],
  plugins: ['unused-imports'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-empty': 'off',
    'prefer-const': 'off',
    'unused-imports/no-unused-imports': 'error',
    // quotes: ['error', 'single', { allowTemplateLiterals: false }],
  },
});
