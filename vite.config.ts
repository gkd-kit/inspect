import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import process from 'node:process';
import unocss from 'unocss/vite';
import data from 'unplugin-data/vite';
import { defineConfig } from 'vite';
import type { ESBuildOptions } from 'vite';
import { mirror, unAutoImport } from './plugins';

export default defineConfig(() => {
  return {
    plugins: [
      vue(),
      vueJsx(),
      unocss(),
      unAutoImport(),
      legacy({ renderLegacyChunks: false, modernPolyfills: true }),
      data(),
      mirror(),
    ],
    resolve: {
      alias: {
        '@': process.cwd() + '/src',
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
      chunkSizeWarningLimit: Number.MAX_SAFE_INTEGER,
    },
    esbuild: <ESBuildOptions>{
      legalComments: 'none',
    },
  };
});
