import { createSharedComposable } from '@vueuse/core';
import { computed, readonly, shallowRef } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import { delay } from '@/shared/lib/async';
import { useLatestTask } from '@/shared/lib/latest_task';
import {
  decodeLegacySelectorQuery,
  decodeSnapshotUrlState,
  encodeSnapshotUrlStateParam,
  isDefaultSnapshotUrlState,
  MAX_SNAPSHOT_URL_QUERY_SIZE,
  type SnapshotUrlQuery,
  type SnapshotUrlState,
} from './snapshot_url_codec';

const getQueryString = (value: unknown): string | undefined => {
  if (typeof value == 'string') return value || undefined;
  if (Array.isArray(value))
    return value.find((item): item is string => typeof item == 'string');
};

const copyState = (state: SnapshotUrlState): SnapshotUrlState => ({
  ...(state.focusNodeId === undefined
    ? {}
    : { focusNodeId: state.focusNodeId }),
  ...(state.queries?.length
    ? { queries: state.queries.map((query) => ({ ...query })) }
    : {}),
});

const isSameState = (left: SnapshotUrlState, right: SnapshotUrlState) =>
  left.focusNodeId === right.focusNodeId &&
  JSON.stringify(left.queries ?? []) === JSON.stringify(right.queries ?? []);

export const useSnapshotUrlState = createSharedComposable(() => {
  const route = useRoute();
  const router = useRouter();
  const state = shallowRef<SnapshotUrlState>({});
  const ready = shallowRef(false);

  const writeTask = useLatestTask(
    async (context, nextState: SnapshotUrlState, path: string) => {
      await delay(150);
      const encoded = await encodeSnapshotUrlStateParam(nextState);
      if (!context.isCurrent() || route.path !== path) return;
      const query = { ...route.query };
      delete query.gkd;
      delete query.str;
      if (encoded) query.state = encoded;
      else delete query.state;
      if (JSON.stringify(query) !== JSON.stringify(route.query)) {
        await router.replace({ path, query });
      }
    },
  );

  const decodeTask = useLatestTask(
    async (
      _context,
      target: Pick<RouteLocationNormalized, 'query'>,
    ): Promise<SnapshotUrlState> => {
      const encoded = getQueryString(target.query.state);
      if (encoded) return decodeSnapshotUrlState(encoded);
      const queries: SnapshotUrlQuery[] = [];
      const legacySelector = getQueryString(target.query.gkd);
      const legacyText = getQueryString(target.query.str);
      if (legacySelector)
        queries.push({
          type: 'selector',
          value: decodeLegacySelectorQuery(legacySelector),
        });
      if (legacyText) queries.push({ type: 'text', value: legacyText });
      return queries.length ? { queries } : {};
    },
  );

  const prepareFromRoute = async (
    target: Pick<RouteLocationNormalized, 'query'>,
  ) => {
    writeTask.cancel();
    const result = await decodeTask.run(target);
    const legacyText =
      !getQueryString(target.query.state) && getQueryString(target.query.str);
    const nextState: SnapshotUrlState =
      result.status === 'success'
        ? result.value
        : legacyText
          ? { queries: [{ type: 'text', value: legacyText }] }
          : {};
    return {
      state: nextState,
      error: result.status === 'error' ? result.error : undefined,
      canonicalize:
        result.status === 'error' ||
        target.query.gkd !== undefined ||
        target.query.str !== undefined ||
        (target.query.state !== undefined &&
          isDefaultSnapshotUrlState(nextState)),
    };
  };

  const commitPreparedState = (nextState: SnapshotUrlState) => {
    const changed = !isSameState(state.value, nextState);
    state.value = copyState(nextState);
    ready.value = true;
    return changed;
  };

  const syncToRoute = (path = route.path) =>
    writeTask.run(copyState(state.value), path);
  const commit = (nextState: SnapshotUrlState) => {
    if (!commitPreparedState(nextState)) return;
    void syncToRoute();
  };
  const setFocusNodeId = (focusNodeId?: number) =>
    commit({ ...state.value, focusNodeId });
  const setQueries = (queries: SnapshotUrlQuery[]) => {
    commit({
      ...state.value,
      queries: queries
        .filter((query) => query.value.length > 0)
        .slice(0, MAX_SNAPSHOT_URL_QUERY_SIZE),
    });
  };
  const cancel = () => {
    writeTask.cancel();
    decodeTask.cancel();
  };
  return {
    state: readonly(state),
    ready: readonly(ready),
    error: computed(() => decodeTask.error.value || writeTask.error.value),
    prepareFromRoute,
    commitPreparedState,
    syncToRoute,
    cancel,
    setFocusNodeId,
    setQueries,
  };
});
