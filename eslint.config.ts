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
    rules: {
      'vue/require-default-prop': 'off',
      'vue/attribute-hyphenation': 'off', //['error', 'never'], 无法识别 :name 和 name
      'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
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
    },
  },
  {
    ignores: ['dist'],
  },
) as any;
