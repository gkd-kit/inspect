import {
  defineConfig,
  presetAttributify,
  presetWind4,
  transformerAttributifyJsx,
} from 'unocss';

export default defineConfig({
  presets: [presetWind4({ preflight: 'on-demand' }), presetAttributify()],
  transformers: [transformerAttributifyJsx()],
});
