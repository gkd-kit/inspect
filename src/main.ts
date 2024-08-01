import 'normalize.css';
import { createPinia } from 'pinia';
import 'virtual:uno.css';
import App from './App.vue';
import i18n from './i18n';
import router from './router';
import { commitLog } from './utils/commit';
import root from './utils/root';
import { dataInitTasks } from './utils/storage';

let init = false;
router.beforeEach(async (to, from, next) => {
  if (!init) {
    await Promise.all(dataInitTasks).catch(console.error);
    init = true;
  }
  next();
});
const pinia = createPinia();
const app = createApp(App);
app.use(i18n);
app.use(router);
app.use(pinia);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
