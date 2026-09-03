import 'normalize.css';
import 'uno.css';
import '@/style/index.scss';
import { updateWasmToMatches } from '@gkd-kit/selector';
import { toMatches } from 'regex-wasm';
import App from './App.vue';
import router from './router';
import commitLog from './utils/commit.data';
import root from './utils/root';
import SvgIcon from './components/base/SvgIcon.vue';

updateWasmToMatches(toMatches);

const app = createApp(App);
app.use(router);
app.component('SvgIcon', SvgIcon);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
