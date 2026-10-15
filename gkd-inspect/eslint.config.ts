import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import pluginPrettier from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import autoImportGlobals from './.eslintrc-auto-import.json' with { type: 'json' };
import projectRules from './eslint-rules/native-element-allowlist.ts';
import stateRules from './eslint-rules/no-implicit-state-watchers.ts';
import componentRules from './eslint-rules/component-conventions.ts';
import boundaryRules from './eslint-rules/import-boundaries.ts';

const combinedProjectRules = {
  rules: {
    ...projectRules.rules,
    ...stateRules.rules,
    ...componentRules.rules,
    ...boundaryRules.rules,
  },
};

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

  // Disallow JavaScript-family source files. Generated and dependency files are ignored above.
  {
    files: ['**/*.{js,mjs,cjs,jsx,mts,cts}'],
    plugins: {
      project: combinedProjectRules,
    },
    rules: {
      'project/typescript-source-files-only': 'error',
    },
  },

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
      'vue/multi-word-component-names': 'error',
    },
  },

  // https://typescript-eslint.io/troubleshooting/faqs/eslint/
  {
    files: ['**/*.{ts,tsx,vue}'],
    rules: {
      'no-undef': 'off',
    },
  },

  // for TS/Vue
  {
    files: ['**/*.{ts,tsx,vue}'],
    plugins: {
      'unused-imports': unusedImports,
      project: combinedProjectRules,
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
      'project/native-element-allowlist': 'error',
      'project/no-implicit-state-watchers': 'error',
      'project/component-conventions': 'error',
      'project/import-boundaries': 'error',
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

  // Watchers are reserved for isolated adapters around imperative UI APIs.
  {
    files: [
      'src/shared/ui/GkDraggableCard.vue',
      'src/shared/ui/GkFullscreenDialog.vue',
      'src/shared/ui/GkSvg.vue',
      'src/shared/ui/GkDraggableCard.ts',
      'src/entities/selector/ui/SelectorTrackGraph.vue',
    ],
    rules: {
      'project/no-implicit-state-watchers': 'off',
    },
  },

  // Prettier finally
  pluginPrettier,
);
