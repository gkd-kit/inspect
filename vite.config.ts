import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath, URL } from 'node:url';
import unocss from 'unocss/vite';
import { defineConfig } from 'vite';
import { _404Page, commit, mirror } from './plugins';

export default defineConfig(({}) => {
  const useMirror = process.env.MIRROR == `ON`;
  return {
    plugins: [
      vue(),
      vueJsx(),
      unocss(),
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
    build: {
      target: `chrome80`,
      // sourcemap: true,
      minify:false
    },
  };
});
