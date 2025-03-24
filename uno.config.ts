import {
  defineConfig,
  presetAttributify,
  presetWind3,
  transformerAttributifyJsx,
} from 'unocss';

export default defineConfig({
  presets: [presetWind3(), presetAttributify()],
  transformers: [transformerAttributifyJsx()],
});
