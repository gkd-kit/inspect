import autoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import components from 'unplugin-vue-components/vite';
import type { Plugin } from 'vite';
import naiveComponents from './naive-components.json';

export const unAutoImport = (): Plugin[] => {
  return [
    autoImport({
      dts: 'auto-import.d.ts',
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        'pinia',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar',
            ...naiveComponents,
          ],
        },
      ],
      eslintrc: {
        enabled: true,
        globalsPropValue: 'readonly',
        filepath: '.eslintrc-auto-import.json',
      },
      dirs: [],
    }),
    components({
      dts: 'auto-import-components.d.ts',
      resolvers: [NaiveUiResolver()],
      dirs: [],
    }),
  ];
};
