import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import autoImport from './.eslintrc-auto-import.json' with { type: 'json' };

export default defineConfig(
  { ignores: ['**/dist'] },
  {
    extends: [
      js.configs.recommended,
      ...ts.configs.recommended,
      ...vue.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        jsx: true,
      },
    },
    rules: {
      'vue/require-default-prop': 'off',
      'vue/attribute-hyphenation': 'off', //['error', 'never'], 无法识别 :name 和 name
      'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],

      'no-undef': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    plugins: {
      'unused-imports': unusedImports as any,
    },
  },
  {
    languageOptions: {
      globals: {
        ...(autoImport.globals as any),
        ...globals.browser,
      },
    },
  },
  {
    rules: {
      'no-empty': 'off',
      'prefer-const': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
  prettier,
) as any;
