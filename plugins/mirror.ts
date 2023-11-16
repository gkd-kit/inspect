import type { Plugin } from 'vite';
import fs from 'node:fs/promises';
import type selfPkgT from '../package.json';
import { parse } from 'node-html-parser';

const selfPkg: typeof selfPkgT = JSON.parse(
  await fs.readFile(process.cwd() + '/package.json', 'utf-8'),
);

const mirrorBaseUrl = `https://registry.npmmirror.com/@gkd-kit/inspect/${selfPkg.version}/files/dist`;

export const mirror = (): Plugin => {
  return {
    name: 'mirror',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const root = parse(html);
      const hrefEls = root.querySelectorAll(`[href^="/"]`);
      hrefEls.forEach((e) => {
        const value = e.getAttribute('href');
        if (value.startsWith('//')) return;
        e.setAttribute('href', mirrorBaseUrl + value);
      });
      const srcEls = root.querySelectorAll(`[src^="/"]`);
      srcEls.forEach((e) => {
        const value = e.getAttribute('src');
        if (value.startsWith('//')) return;
        e.setAttribute('src', mirrorBaseUrl + value);
      });
      return root.toString();
    },
    renderDynamicImport() {
      return {
        left: `import(new URL(`,
        right: `, import.meta.url).href)`,
      };
    },
  };
};
