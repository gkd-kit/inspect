import { createSharedComposable, useDebounceFn } from '@vueuse/core';
import { useRouteQuery } from '@vueuse/router';
import { readonly, shallowRef } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import {
  decodeLegacySelectorQuery,
  decodeSnapshotUrlState,
  encodeSnapshotUrlStateParam,
  isDefaultSnapshotUrlState,
  MAX_SNAPSHOT_URL_QUERY_SIZE,
  type SnapshotUrlQuery,
  type SnapshotUrlState,
} from './snapshot_url_codec';

const EMPTY_STATE: SnapshotUrlState = {};
const WRITE_DEBOUNCE = 150;

const getQueryString = (value: unknown): string | undefined => {
  if (typeof value == 'string') return value || undefined;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item == 'string');
  }
};

const isSameQueries = (
  left: SnapshotUrlQuery[] | undefined,
  right: SnapshotUrlQuery[] | undefined,
): boolean => {
  const leftQueries = left ?? [];
  const rightQueries = right ?? [];
  return (
    leftQueries.length == rightQueries.length &&
    leftQueries.every(
      (query, index) =>
        query.type == rightQueries[index].type &&
        query.value == rightQueries[index].value,
    )
  );
};

const copyState = (state: SnapshotUrlState): SnapshotUrlState => ({
  ...(state.focusNodeId === undefined
    ? {}
    : { focusNodeId: state.focusNodeId }),
  ...(state.queries?.length
    ? { queries: state.queries.map((query) => ({ ...query })) }
    : {}),
});

const isSameState = (
  left: SnapshotUrlState,
  right: SnapshotUrlState,
): boolean =>
  left.focusNodeId == right.focusNodeId &&
  isSameQueries(left.queries, right.queries);

export const useSnapshotUrlState = createSharedComposable(() => {
  const route = useRoute();
  const router = useRouter();
  const encodedState = useRouteQuery('state');

  const state = shallowRef<SnapshotUrlState>(EMPTY_STATE);
  const ready = shallowRef(false);
  const error = shallowRef<Error>();
  let routeRevision = 0;
  let writeRevision = 0;

  const replaceCanonicalQuery = async (encoded?: string) => {
    const query = { ...route.query };
    delete query.gkd;
    delete query.str;
    if (encoded) {
      query.state = encoded;
    } else {
      delete query.state;
    }
    await router.replace({ query });
  };

  const writeEncodedState = useDebounceFn(
    async (
      revision: number,
      nextState: SnapshotUrlState,
      routePath: string,
    ) => {
      try {
        const encoded = await encodeSnapshotUrlStateParam(nextState);
        if (revision != writeRevision || routePath != route.path) {
          return;
        }
        const hasLegacyQuery =
          route.query.gkd !== undefined || route.query.str !== undefined;
        if (getQueryString(encodedState.value) == encoded && !hasLegacyQuery) {
          return;
        }
        error.value = undefined;
        if (hasLegacyQuery) {
          await replaceCanonicalQuery(encoded);
        } else {
          encodedState.value = encoded;
        }
      } catch (cause) {
        if (revision == writeRevision) {
          error.value =
            cause instanceof Error ? cause : new Error(String(cause));
        }
      }
    },
    WRITE_DEBOUNCE,
  );

  const commit = (nextState: SnapshotUrlState) => {
    routeRevision += 1;
    const revision = ++writeRevision;
    const copiedState = copyState(nextState);
    state.value = copiedState;
    ready.value = true;
    void writeEncodedState(revision, copiedState, route.path);
  };

  const setFocusNodeId = (focusNodeId?: number) => {
    if (state.value.focusNodeId == focusNodeId) return;
    commit({ ...state.value, focusNodeId });
  };

  const setQueries = (queries: SnapshotUrlQuery[]) => {
    const nextQueries = queries
      .filter((query) => query.value.length > 0)
      .slice(0, MAX_SNAPSHOT_URL_QUERY_SIZE)
      .map((query) => ({ ...query }));
    if (isSameQueries(state.value.queries, nextQueries)) return;
    const nextState = { ...state.value };
    if (nextQueries.length > 0) {
      nextState.queries = nextQueries;
    } else {
      delete nextState.queries;
    }
    commit(nextState);
  };

  const loadFromRoute = async (
    target: Pick<RouteLocationNormalized, 'path' | 'query'> = route,
  ): Promise<boolean> => {
    const revision = ++routeRevision;
    writeRevision += 1;
    const routePath = target.path;
    ready.value = false;
    error.value = undefined;
    const legacySelector = getQueryString(target.query.gkd);
    const legacyText = getQueryString(target.query.str);
    const encoded = getQueryString(target.query.state);
    let nextState: SnapshotUrlState = EMPTY_STATE;
    let canonicalize =
      target.query.gkd !== undefined ||
      target.query.str !== undefined ||
      (target.query.state !== undefined && !encoded);

    if (encoded) {
      try {
        nextState = await decodeSnapshotUrlState(encoded);
        if (isDefaultSnapshotUrlState(nextState)) canonicalize = true;
      } catch (cause) {
        error.value = cause instanceof Error ? cause : new Error(String(cause));
        canonicalize = true;
      }
    } else if (legacySelector || legacyText) {
      const queries: SnapshotUrlQuery[] = [];
      if (legacySelector) {
        try {
          queries.push({
            type: 'selector',
            value: decodeLegacySelectorQuery(legacySelector),
          });
        } catch (cause) {
          error.value =
            cause instanceof Error ? cause : new Error(String(cause));
        }
      }
      if (legacyText) queries.push({ type: 'text', value: legacyText });
      nextState = queries.length > 0 ? { queries } : EMPTY_STATE;
    }

    if (revision != routeRevision) return false;
    const changed = !isSameState(state.value, nextState);
    state.value = copyState(nextState);
    ready.value = true;

    if (canonicalize && routePath == route.path) {
      try {
        const canonicalState = await encodeSnapshotUrlStateParam(nextState);
        if (revision != routeRevision || routePath != route.path)
          return changed;
        await replaceCanonicalQuery(canonicalState);
      } catch (cause) {
        error.value = cause instanceof Error ? cause : new Error(String(cause));
        if (revision == routeRevision && routePath == route.path) {
          await replaceCanonicalQuery();
        }
      }
    }
    return changed;
  };

  return {
    state: readonly(state),
    ready: readonly(ready),
    error: readonly(error),
    loadFromRoute,
    setFocusNodeId,
    setQueries,
  };
});
