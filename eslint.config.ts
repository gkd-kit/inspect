import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';
import autoImport from './.eslintrc-auto-import.json' with { type: 'json' };
import globals from 'globals';

export default ts.config(
  prettier,
  {
    extends: [
      js.configs.recommended,
      ...ts.configs.recommended,
      ...vue.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
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
    languageOptions: {
      globals: {
        ...(autoImport.globals as Record<string, 'readonly'>),
        ...globals.browser,
      },
    },
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
      'vue/require-default-prop': 'off',
    },
  },
  {
    ignores: ['dist'],
  },
) as any;
