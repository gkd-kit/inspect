import fs from 'node:fs/promises';
import type { Plugin } from 'vite';
import type selfPkgT from '../package.json';

const selfPkg: typeof selfPkgT = JSON.parse(
  await fs.readFile(process.cwd() + '/package.json', 'utf-8'),
);

const mirrorBaseUrl = `https://registry.npmmirror.com/@gkd-kit/inspect/${selfPkg.version}/files/dist`;

export const mirror = (): Plugin => {
  return {
    name: 'mirror',
    apply: 'build',
    enforce: 'post',
    config() {
      if (process.env.MIRROR == `ON`) {
        return {
          experimental: {
            renderBuiltUrl(filename) {
              return mirrorBaseUrl + '/' + filename;
            },
          },
        };
      }
    },
  };
};
