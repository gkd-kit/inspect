import { onBeforeMount, onScopeDispose } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router';

export const useSnapshotRoute = (
  load: (route: RouteLocationNormalized) => void,
  cancel: () => void,
) => {
  const route = useRoute();
  const router = useRouter();
  const removeHook = router.afterEach((to, _from, failure) => {
    if (failure) return;
    if (to.params.snapshotId || to.params.github_asset_id) load(to);
    else cancel();
  });
  onBeforeMount(() => load(route));
  onScopeDispose(() => {
    removeHook();
    cancel();
  });
};
