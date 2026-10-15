import type { Plugin } from 'vite';
export const _404Page = (): Plugin => {
  return {
    name: `_404Page`,
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: Reflect.get(bundle['index.html'], 'source'),
      });
    },
  };
};
