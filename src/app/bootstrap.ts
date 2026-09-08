import 'normalize.css';
import 'uno.css';
import '@/shared/styles/index.scss';
import { updateWasmToMatches } from '@gkd-kit/selector';
import { toMatches } from 'regex-wasm';
import App from './App.vue';
import commitLog from './commit.data';
import router from './router';
import root from '@/shared/lib/root';
import { reportGlobalError } from '@/shared/services/globalError';

updateWasmToMatches(toMatches);

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  reportGlobalError(error, `Vue: ${info}`);
};
app.use(router);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
