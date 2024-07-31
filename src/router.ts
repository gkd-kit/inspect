import { toValidURL } from '@/utils/check';
import { getImportFileUrl } from '@/utils/url';
import type { RouteRecordRedirectOption } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

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
      component: () => import('@/views/home/HomePage.vue'),
    },
    {
      path: '/snapshot/:snapshotId',
      name: 'snapshot',
      component: () => import('@/views/snapshot/SnapshotPage.vue'),
    },
    {
      path: '/i',
      component: () => import('@/views/ImportPage.vue'),
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
      component: () => import('@/views/DevicePage.vue'),
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
      path: '/s',
      component: () => import('@/views/PreviewSharePage.vue'),
      beforeEnter(to, _, next) {
        if (to.query.url) {
          const u = toValidURL(String(to.query.url));
          if (u) {
            return next();
          }
        }
        return next({ path: '/404' });
      },
    },
    {
      path: '/s/:github_asset_id',
      component: () => import('@/views/PreviewSharePage.vue'),
      beforeEnter(to, _, next) {
        const github_asset_id = String(to.params.github_asset_id).match(
          /^\d+/,
        )?.[0];
        if (!github_asset_id) {
          return next({ path: '/404' });
        }
        if (to.params.github_asset_id === github_asset_id) {
          return next();
        } else {
          return next('/s/' + github_asset_id);
        }
      },
    },
    {
      path: '/selector',
      component: () => import('@/views/SelectorPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/views/_404Page.vue'),
    },
  ],
});

export default router;
