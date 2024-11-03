import { toValidURL } from '@/utils/check';
import { getImportFileUrl } from '@/utils/url';
import type { RouteRecordRedirectOption } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

const routeModules = new Set<() => unknown>();
const recordModule = <T, S extends () => T>(v: S): S => {
  routeModules.add(v);
  return v;
};

const redirectImport: RouteRecordRedirectOption = (to) => {
  const github_asset_id = String(to.params.github_asset_id).match(/^\d+/)?.[0]; // 丢弃非法字符
  if (!github_asset_id) {
    return { path: '/404' };
  }
  return {
    path: '/i',
    query: {
      ...to.query,
      url: getImportFileUrl(github_asset_id),
    },
  };
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: recordModule(() => import('@/views/home/HomePage.vue')),
    },
    {
      path: '/snapshot/:snapshotId',
      name: 'snapshot',
      component: recordModule(
        () => import('@/views/snapshot/SnapshotPage.vue'),
      ),
    },
    {
      path: '/i',
      component: recordModule(() => import('@/views/ImportPage.vue')),
    },
    {
      path: '/i/:github_asset_id',
      redirect: redirectImport,
    },
    {
      path: '/import',
      redirect(to) {
        return {
          path: '/i',
          query: to.query,
        };
      },
    },
    {
      path: `/import/:github_asset_id`,
      redirect: redirectImport,
    },
    {
      path: '/device',
      component: recordModule(() => import('@/views/DevicePage.vue')),
      beforeEnter(to, _, next) {
        const u = toValidURL(String(to.query.url));
        if (u) {
          localStorage.setItem('device_link', u.origin);
          const query = { ...to.query };
          delete query.url;
          return next({ ...to, query });
        }
        next();
      },
    },
    {
      path: '/selector',
      component: recordModule(() => import('@/views/SelectorPage.vue')),
    },
    {
      path: '/:pathMatch(.*)*',
      component: recordModule(() => import('@/views/_404Page.vue')),
    },
  ],
});

if (import.meta.env.PROD) {
  setTimeout(() => {
    // 预加载所有路由组件
    routeModules.forEach((v) => v());
  }, 3000);
}

export default router;
