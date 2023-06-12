import {
  defineConfig,
  presetAttributify,
  presetUno,
  transformerAttributifyJsx,
} from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  transformers: [transformerAttributifyJsx()],
});
