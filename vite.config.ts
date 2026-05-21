import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import unocss from 'unocss/vite';
import data from 'unplugin-data/vite';
import { defineConfig } from 'vite';
import { _404Page, mirror, svgMinify, unAutoImport } from './plugins';

// support top-level-await
const chromeVersion = 89;
const host = '127.0.0.1';
const port = 8444;

export default defineConfig(() => {
  return {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      svgMinify(),
      vue(),
      vueJsx(),
      unocss({ inspector: false }),
      unAutoImport(),
      data(),
      legacy({
        renderLegacyChunks: false,
        modernPolyfills: true,
        modernTargets: `chrome>=${chromeVersion}`,
      }),
      mirror(),
      _404Page(),
    ],
    server: {
      host,
      port,
    },
    preview: {
      host,
      port,
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: Number.MAX_SAFE_INTEGER,
    },
  };
});
