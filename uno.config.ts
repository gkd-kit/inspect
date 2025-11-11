import {
  defineConfig,
  presetAttributify,
  presetWind3,
  transformerAttributifyJsx,
} from 'unocss';

export default defineConfig({
  presets: [presetWind3({ preflight: 'on-demand' }), presetAttributify()],
  transformers: [transformerAttributifyJsx()],
});
