import type { Plugin } from 'vite';
export const _404Page = (): Plugin => {
  return {
    name: `_404Page`,
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      // https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-app-spa-rendering
      // bundle['404.html'] = { ...bundle[`index.html`], fileName: `404.html` };
    },
  };
};
