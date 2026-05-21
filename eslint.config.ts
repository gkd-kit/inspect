import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import pluginPrettier from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import autoImportGlobals from './.eslintrc-auto-import.json' with { type: 'json' };

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public',
      'auto-imports.d.ts',
      'components.d.ts',
      'auto-import-components.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Vue SFC + TypeScript parser
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // https://typescript-eslint.io/troubleshooting/faqs/eslint/
  {
    files: ['**/*.{ts,tsx,mts,cts,vue}'],
    rules: {
      'no-undef': 'off',
    },
  },

  // for JS/TS/Vue
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...autoImportGlobals.globals,
      },
    },
    rules: {
      'vue/require-default-prop': 'off',
      'vue/attribute-hyphenation': 'off', //['error', 'never'], 无法识别 :name 和 name
      'vue/v-on-event-hyphenation': ['error', 'never', { autofix: true }],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'no-empty': 'off',
      'no-useless-assignment': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Prettier finally
  pluginPrettier,
);
