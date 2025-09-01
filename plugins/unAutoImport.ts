import process from 'node:process';
import { getExportsStatic } from 'pkg-exports';
import autoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import components from 'unplugin-vue-components/vite';

export const unAutoImport = async () => {
  return [
    autoImport({
      dts: process.cwd() + '/src/types/auto-import.d.ts',
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        {
          'naive-ui': (await getExportsStatic('naive-ui')).filter(
            (v) => v.startsWith('N') || v.startsWith('use'),
          ),
        },
      ],
      eslintrc: {
        enabled: true,
        globalsPropValue: 'readonly',
        filepath: '.eslintrc-auto-import.json',
      },
      dirs: [process.cwd() + '/src/store/**'],
    }),
    components({
      include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/],
      dts: process.cwd() + '/src/types/auto-import-components.d.ts',
      resolvers: [NaiveUiResolver()],
      dirs: [],
    }),
  ];
};
