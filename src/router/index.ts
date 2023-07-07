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
      path: '/device',
      name: 'device',
      component: () => import('@/views/DevicePage.vue'),
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('@/views/TestPage.vue'),
    },
  ],
});

export default router;
