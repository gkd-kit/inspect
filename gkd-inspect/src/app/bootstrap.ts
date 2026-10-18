import { createApp } from 'vue';
import '@/shared/styles/tailwind.css';
import '@/shared/styles/global.css';
import App from './App.vue';
import commitLog from './commit.data';
import router from './router';
import root from '@/shared/lib/root';
import { reportGlobalError } from '@/shared/services/globalError';

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  reportGlobalError(error, `Vue: ${info}`);
};
app.use(router);
app.mount(root);

if (import.meta.env.PROD) {
  console.log(commitLog);
}
