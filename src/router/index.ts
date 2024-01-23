import { toValidURL } from '@/utils/check';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/HomePage.vue'),
    },
    {
      path: '/snapshot/:snapshotId',
      name: 'snapshot',
      component: () => import('@/views/SnapshotPage.vue'),
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('@/views/ImportPage.vue'),
    },
    {
      // https://github.com/gkd-kit/inspect/files/12448138/file.zip
      path: `/import/:github_zip_asset_id`,
      redirect(to) {
        const github_zip_asset_id = String(to.params.github_zip_asset_id).match(
          /^\d+/,
        )?.[0]; // 丢弃非法字符
        if (!github_zip_asset_id) {
          return { path: '/404' };
        }
        const url = `https://github.com/gkd-kit/inspect/files/${github_zip_asset_id}/file.zip`;
        return {
          name: `import`,
          query: {
            url,
          },
        };
      },
    },
    {
      path: '/device',
      name: 'device',
      component: () => import('@/views/DevicePage.vue'),
      beforeEnter(to, from, next) {
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
      path: '/404',
      component: () => import('@/views/_404Page.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404',
    },
  ],
});

export default router;
