import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/HomePage.vue'),
    },
    {
      path: '/snapshot/:id',
      name: 'snapshot',
      component: () => import('@/views/SnapshotPage.vue'),
    },
  ],
});

export default router;
