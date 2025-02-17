// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';
import autoImport from './.eslintrc-auto-import.json' with { type: 'json' };

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  // @ts-ignore
  ...vue.configs['flat/essential'],
  prettier,
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
        jsx: true,
      },
    },
  },
  {
    plugins: {
      'unused-imports': unusedImports,
    },
  },
  {
    // @ts-ignore
    languageOptions: autoImport,
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    ignores: ['*.d.ts', '*.cjs'],
  },
);
