import {
  defineConfig,
  presetAttributify,
  presetWind4,
  transformerAttributifyJsx,
} from 'unocss';

export default defineConfig({
  presets: [presetWind4(), presetAttributify()],
  transformers: [transformerAttributifyJsx()],
});
