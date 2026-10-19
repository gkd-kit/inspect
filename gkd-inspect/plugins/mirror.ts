import fs from 'node:fs/promises';
import type { Plugin } from 'vite';
import type selfPkgT from '../package.json';

const selfPkg: typeof selfPkgT = JSON.parse(
  await fs.readFile(process.cwd() + '/package.json', 'utf-8'),
);

const mirrorBaseUrl = `https://registry.npmmirror.com/@gkd-kit/inspect/${selfPkg.version}/files/dist`;
const workerEntryPrefix = `assets/worker-entry-`;

export const mirror = (): Plugin => {
  return {
    name: 'mirror',
    apply(_config, { command }) {
      return command == `build` && process.env.MIRROR == `ON`;
    },
    enforce: 'post',
    config() {
      return {
        worker: {
          rollupOptions: {
            output: {
              entryFileNames: `${workerEntryPrefix}[name]-[hash].js`,
            },
          },
        },
        experimental: {
          renderBuiltUrl(filename) {
            const url = mirrorBaseUrl + '/' + filename;
            if (filename.startsWith(workerEntryPrefix)) {
              return `data:text/javascript,${encodeURIComponent(`import ${JSON.stringify(url)};`)}`;
            }
            return url;
          },
        },
      };
    },
  };
};
