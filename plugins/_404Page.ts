import type { Plugin } from 'vite';
export const _404Page = (): Plugin => {
  return {
    name: `404Page`,
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      bundle['404.html'] = { ...bundle[`index.html`], fileName: `404.html` };
    },
  };
};
