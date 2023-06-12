import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath, URL } from 'node:url';
import unocss from 'unocss/vite';
import { defineConfig } from 'vite';
import { _404Page } from './plugins';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      vueJsx(),
      unocss(),
      legacy({ renderLegacyChunks: false, modernPolyfills: true }),
      _404Page(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 8444,
    },
    build: {
      target: `chrome80`,
      sourcemap: true,
    },
  };
});
