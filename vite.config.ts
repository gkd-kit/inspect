import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath, URL } from 'node:url';
import unocss from 'unocss/vite';
import { defineConfig } from 'vite';
import { _404Page, commit, mirror } from './plugins';
import components from 'unplugin-vue-components/vite';
import autoImport from 'unplugin-auto-import/vite';

export default defineConfig(() => {
  const useMirror = process.env.MIRROR == `ON`;
  return {
    plugins: [
      vue(),
      vueJsx(),
      unocss(),
      autoImport({
        dts: 'auto-import.d.ts',
        imports: ['vue', 'vue-router', '@vueuse/core'],
        eslintrc: {
          enabled: true,
          globalsPropValue: 'readonly',
          filepath: '.eslintrc-auto-import.json',
        },
        dirs: [],
      }),
      components({
        dts: 'auto-import-components.d.ts',
        dirs: [],
      }),
      legacy({ renderLegacyChunks: false, modernPolyfills: true }),
      commit(),
      useMirror ? mirror() : undefined,
      _404Page(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 8444,
    },
    preview: {
      host: '127.0.0.1',
      port: 8444,
    },
    build: {
      target: `chrome70`,
      sourcemap: true,
    },
  };
});
