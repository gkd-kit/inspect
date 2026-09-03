import 'normalize.css';
import 'uno.css';
import '@/shared/styles/index.scss';
import { updateWasmToMatches } from '@gkd-kit/selector';
import { toMatches } from 'regex-wasm';
import App from './app/App.vue';
import commitLog from './app/commit.data';
import router from './app/router';
import root from './shared/lib/root';

updateWasmToMatches(toMatches);

const app = createApp(App);
app.use(router);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
