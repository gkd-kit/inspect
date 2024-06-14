import 'virtual:uno.css';
import 'normalize.css';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
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

const app = createApp(App);
app.use(i18n);
app.use(router);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
