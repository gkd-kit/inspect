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
      path: `/import/:github_user_id/:github_img_asset_id`,
      redirect(to) {
        // https://github.com/gkd-kit/inspect/assets/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a
        const url = `https://github.com/gkd-kit/inspect/assets/${to.params.github_user_id}/${to.params.github_img_asset_id}`;
        return {
          name: `import`,
          query: {
            url,
          },
        };
      },
    },
    {
      path: `/import/:github_zip_asset_id`,
      redirect(to) {
        // https://github.com/gkd-kit/inspect/files/12448138/file.zip
        const url = `https://github.com/gkd-kit/inspect/files/${to.params.github_zip_asset_id}/file.zip`;
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
