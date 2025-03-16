import 'normalize.css';
import 'uno.css';
import '@/style/index.scss';
import App from './App.vue';
import router from './router';
import commitLog from './utils/commit.data';
import root from './utils/root';
import SvgIcon from './components/SvgIcon.vue';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);
app.component('SvgIcon', SvgIcon);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
