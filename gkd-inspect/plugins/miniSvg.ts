import type { Plugin } from 'vite';

export function svgMinify(): Plugin {
  return {
    name: 'vite-svg-minify',
    apply: 'build',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith('.svg?raw')) return;
      const [fp] = id.split('?');
      const text = await this.fs.readFile(fp, { encoding: 'utf8' });
      const { optimize } = await import('svgo');
      const result = optimize(text);
      return `export default ${JSON.stringify(result.data)};`;
    },
  };
}
