import {
  computed,
  nextTick,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
} from 'vue';
import {
  createSharedComposable,
  useElementBounding,
  useElementSize,
} from '@vueuse/core';
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router';
import type { RawNode, Snapshot } from '@/entities/snapshot/types';
import type { Position } from '@/shared/types/common';
import {
  detectSnapshot,
  exportSnapshotAsImageId,
  exportSnapshotAsImportId,
} from '@/features/snapshot-management/export';
import { gmOk } from '@/shared/api/gm';
import { readSnapshotFromNetwork } from '@/features/snapshot-management/import';
import {
  findNodesByXy,
  getAppInfo,
  listToTree,
} from '@/entities/snapshot/node';
import { toFixedNumber, toInteger } from '@/shared/lib/number';
import { useLatestTask, type TaskContext } from '@/shared/lib/latest_task';
import type { ResolvedSelector } from '@/entities/selector/parser';
import type { SelectorTrackData } from '@/entities/selector/types';
import {
  screenshotStorage,
  snapshotStorage,
} from '@/entities/snapshot/storage';
import { getImportFileUrl } from '@/entities/snapshot/urls';
import { getSnapshotImportId } from '@/entities/snapshot/api';
import type { SelectorMatch } from '@gkd-kit/selector';
import {
  importSnapshotId,
  snapshotImageId,
  snapshotImportId,
  snapshotMetadataActions,
} from '@/entities/snapshot/metadataStore';
import { settingsStore } from '@/features/settings/store';
import { useSnapshotUrlState } from './snapshot_url_state';

if (import.meta.hot) {
  import.meta.hot.accept(() => location.reload());
}

type SnapshotRouteSource =
  | { type: 'snapshot'; snapshotId: number }
  | { type: 'import'; importId: number }
  | undefined;

const getRouteSource = (
  target: Pick<RouteLocationNormalized, 'params'>,
): SnapshotRouteSource => {
  const snapshotId = toInteger(target.params.snapshotId);
  if (snapshotId) return { type: 'snapshot', snapshotId };
  const importId = toInteger(
    String(target.params.github_asset_id).match(/^\d+/)?.[0],
  );
  if (importId) return { type: 'import', importId };
};

type SnapshotFrame = {
  snapshot?: Snapshot;
  screenshotUrl?: string;
  nodes: RawNode[];
  rootNode?: RawNode;
};

type SnapshotData = {
  snapshot?: Snapshot;
  screenshot?: ArrayBuffer;
  importId?: number;
  imported?: boolean;
};

export const useSnapshotStore = createSharedComposable(() => {
  const route = useRoute();
  const router = useRouter();
  const snapshotUrlState = useSnapshotUrlState();
  const frame = shallowRef<SnapshotFrame>({ nodes: [] });
  const snapshot = computed(() => frame.value.snapshot);
  const snapshotId = computed(() => snapshot.value?.id);
  const screenshotUrl = computed(() => frame.value.screenshotUrl);
  const nodes = computed(() => frame.value.nodes);
  const rootNode = computed(() => frame.value.rootNode);
  const importId = computed(() =>
    snapshotId.value ? snapshotImportId[snapshotId.value] : undefined,
  );
  const imageId = computed(() =>
    snapshotId.value ? snapshotImageId[snapshotId.value] : undefined,
  );
  const missNodeSize = computed(() =>
    Math.max(0, (snapshot.value?.nodes.length ?? 0) - nodes.value.length),
  );
  const focusNode = shallowRef<RawNode>();
  const focusTime = shallowRef(0);
  const focusPosition = shallowRef<Position>();
  const overlapNodes = shallowRef<RawNode[]>();
  const trackShow = shallowRef(false);
  const trackData = shallowRef<SelectorTrackData>();
  const searchRevision = shallowRef(0);
  let activePath = '';
  type FocusListener = (node: RawNode, scrollTree: boolean) => void;
  const focusListeners = new Set<FocusListener>();
  const subscribeFocus = (listener: FocusListener) => {
    focusListeners.add(listener);
    if (focusNode.value) listener(focusNode.value, false);
    return () => focusListeners.delete(listener);
  };
  const notifyFocus = (scrollTree: boolean) => {
    const node = focusNode.value;
    if (node) focusListeners.forEach((listener) => listener(node, scrollTree));
  };
  const updateFocusNode = (
    node: RawNode,
    options: { syncUrl?: boolean; scrollTree?: boolean } = {},
  ) => {
    focusNode.value = node;
    focusTime.value = Date.now();
    if (overlapNodes.value && !overlapNodes.value.includes(node)) {
      focusPosition.value = undefined;
      overlapNodes.value = undefined;
    }
    if (options.syncUrl !== false)
      snapshotUrlState.setFocusNodeId(
        node.id === rootNode.value?.id ? undefined : node.id,
      );
    notifyFocus(options.scrollTree !== false);
  };

  const readLocalSnapshot = async (id: number): Promise<SnapshotData> => {
    const [snapshot, screenshot] = await Promise.all([
      snapshotStorage.getItem(id),
      screenshotStorage.getItem(id),
    ]);
    return {
      snapshot: snapshot || undefined,
      screenshot: screenshot || undefined,
    };
  };
  const findSnapshotIdByImportId = (id: number) =>
    importSnapshotId[id] ||
    toInteger(
      Object.entries(snapshotImportId).find(([, value]) => value === id)?.[0],
    );

  const readImportSnapshot = async (
    id: number,
    context: TaskContext,
  ): Promise<SnapshotData> => {
    const localId = findSnapshotIdByImportId(id);
    if (localId) {
      const data = await readLocalSnapshot(localId);
      if (data.snapshot || !context.isCurrent())
        return { ...data, importId: id };
    }
    const remote = await readSnapshotFromNetwork(getImportFileUrl(id));
    if (!context.isCurrent() || !remote) return { importId: id };
    await Promise.all([
      snapshotStorage.setItem(remote.snapshot.id, remote.snapshot),
      screenshotStorage.setItem(remote.snapshot.id, remote.screenshotBf),
    ]);
    return {
      snapshot: remote.snapshot,
      screenshot: remote.screenshotBf,
      importId: id,
      imported: true,
    };
  };
  const readSnapshot = async (
    source: SnapshotRouteSource,
    context: TaskContext,
  ): Promise<SnapshotData> => {
    if (!source) return {};
    if (source.type === 'import')
      return readImportSnapshot(source.importId, context);
    const data = await readLocalSnapshot(source.snapshotId);
    if (!context.isCurrent()) return {};
    const knownImportId = snapshotImportId[source.snapshotId];
    if (data.snapshot) return { ...data, importId: knownImportId };
    const remoteImportId =
      knownImportId ||
      (await getSnapshotImportId(source.snapshotId).catch(() => null));
    if (!context.isCurrent()) return {};
    return remoteImportId && Number.isSafeInteger(remoteImportId)
      ? readImportSnapshot(remoteImportId, context)
      : {};
  };

  const postLoadTask = useLatestTask(
    async (
      context,
      currentSnapshot: Snapshot,
      source: SnapshotRouteSource,
      path: string,
    ) => {
      let currentImportId = snapshotImportId[currentSnapshot.id];
      if (gmOk() && settingsStore.autoUploadImport) {
        const tasks: Promise<unknown>[] = [];
        if (!snapshotImageId[currentSnapshot.id])
          tasks.push(exportSnapshotAsImageId(currentSnapshot));
        if (!currentImportId)
          tasks.push(
            exportSnapshotAsImportId(currentSnapshot).then((id) => {
              currentImportId = id;
            }),
          );
        await Promise.allSettled(tasks);
      }
      if (!context.isCurrent() || route.path !== path) return;
      currentImportId = snapshotImportId[currentSnapshot.id] || currentImportId;
      if (currentImportId && !importSnapshotId[currentImportId])
        void detectSnapshot(currentSnapshot.id, currentImportId);
      if (source?.type === 'snapshot' && currentImportId) {
        await router.replace({
          path: '/i/' + currentImportId,
          query: route.query,
        });
      }
    },
  );

  const loadTask = useLatestTask(
    async (
      context,
      target: Pick<RouteLocationNormalized, 'path' | 'params' | 'query'>,
    ) => {
      postLoadTask.cancel();
      const source = getRouteSource(target);
      const preparedUrl = await snapshotUrlState.prepareFromRoute(target);
      if (!context.isCurrent()) return;
      const pathChanged = activePath !== target.path;
      const sameSnapshot =
        source?.type === 'snapshot'
          ? source.snapshotId === snapshotId.value
          : source?.type === 'import' &&
            findSnapshotIdByImportId(source.importId) === snapshotId.value;
      const replaceFrame = pathChanged && (!sameSnapshot || !snapshot.value);
      let nextFrame = frame.value;
      let data: SnapshotData = {
        snapshot: snapshot.value,
        importId: source?.type === 'import' ? source.importId : importId.value,
      };
      let preparedImageUrl: string | undefined;
      let committed = false;
      try {
        if (replaceFrame) {
          data = await readSnapshot(source, context);
          if (!context.isCurrent()) return;
          const preparedNodes = structuredClone(
            data.snapshot?.nodes.slice(0, settingsStore.maxShowNodeSize) ?? [],
          );
          const preparedRoot = preparedNodes.length
            ? listToTree(preparedNodes)
            : undefined;
          if (data.snapshot && data.screenshot) {
            preparedImageUrl = URL.createObjectURL(new Blob([data.screenshot]));
            const image = new Image();
            image.src = preparedImageUrl;
            await image.decode();
            if (!context.isCurrent()) return;
          }
          nextFrame = {
            snapshot: data.snapshot,
            screenshotUrl: preparedImageUrl,
            nodes: preparedNodes,
            rootNode: preparedRoot,
          };
        }
        const nextFocus =
          nextFrame.nodes.find(
            (node) => node.id === preparedUrl.state.focusNodeId,
          ) || nextFrame.rootNode;
        const canonicalFocusId =
          nextFocus?.id === nextFrame.rootNode?.id ? undefined : nextFocus?.id;
        const canonicalize =
          preparedUrl.canonicalize ||
          preparedUrl.state.focusNodeId !== canonicalFocusId;
        const oldUrl = frame.value.screenshotUrl;
        committed = context.commit(() => {
          const urlChanged = snapshotUrlState.commitPreparedState({
            ...preparedUrl.state,
            focusNodeId: canonicalFocusId,
          });
          frame.value = nextFrame;
          focusNode.value = nextFocus;
          focusTime.value = Date.now();
          if (pathChanged) {
            focusPosition.value = undefined;
            overlapNodes.value = undefined;
            trackShow.value = false;
            trackData.value = undefined;
          }
          if (pathChanged || urlChanged) searchRevision.value += 1;
          activePath = target.path;
          if (data.snapshot) {
            if (data.imported) {
              const id = data.snapshot.id;
              Object.entries(importSnapshotId).forEach(([key, value]) => {
                if (value === id && Number(key) !== data.importId)
                  snapshotMetadataActions.setSnapshotId(key);
              });
              snapshotMetadataActions.setImageId(id);
              snapshotMetadataActions.setImportTime(id, Date.now());
            }
            if (data.importId) {
              snapshotMetadataActions.setSnapshotId(
                data.importId,
                data.snapshot.id,
              );
              snapshotMetadataActions.setImportId(
                data.snapshot.id,
                data.importId,
              );
            }
            snapshotMetadataActions.setViewedTime(data.snapshot.id, Date.now());
          }
          notifyFocus(false);
        });
        if (!committed) return;
        if (data.snapshot)
          document.title =
            '快照-' + (getAppInfo(data.snapshot).name || data.snapshot.appId);
        await nextTick();
        if (oldUrl && oldUrl !== screenshotUrl.value)
          URL.revokeObjectURL(oldUrl);
        if (!context.isCurrent()) return;
        if (canonicalize) await snapshotUrlState.syncToRoute(target.path);
        if (context.isCurrent() && data.snapshot)
          void postLoadTask.run(data.snapshot, source, target.path);
        return preparedUrl.error;
      } finally {
        if (!committed && preparedImageUrl)
          URL.revokeObjectURL(preparedImageUrl);
      }
    },
  );
  const cancelLoad = () => {
    loadTask.cancel();
    postLoadTask.cancel();
    snapshotUrlState.cancel();
  };
  onScopeDispose(() => {
    cancelLoad();
    if (screenshotUrl.value) URL.revokeObjectURL(screenshotUrl.value);
  });
  const updatePosition = (position: Position) => {
    const resultNodes = findNodesByXy(nodes.value, position);
    focusPosition.value = position;
    overlapNodes.value = resultNodes.length > 1 ? resultNodes : undefined;
    if (resultNodes[0]) updateFocusNode(resultNodes[0]);
  };
  const closeOverlap = () => {
    overlapNodes.value = undefined;
  };
  const showTrack = (
    selector: ResolvedSelector,
    result: SelectorMatch<RawNode>,
  ) => {
    trackShow.value = true;
    trackData.value = { selector, nodes: nodes.value, queryResult: result };
  };
  const closeTrack = () => {
    trackShow.value = false;
  };
  const clearTrack = () => {
    trackData.value = undefined;
  };
  return {
    snapshotId,
    snapshot,
    rootNode,
    screenshotUrl,
    loading: loadTask.loading,
    error: computed(
      () =>
        loadTask.error.value ||
        snapshotUrlState.error.value ||
        postLoadTask.error.value,
    ),
    loadFromRoute: loadTask.run,
    cancelLoad,
    searchRevision: shallowReadonly(searchRevision),
    importId,
    imageId,
    focusNode: shallowReadonly(focusNode),
    updateFocusNode,
    focusTime: shallowReadonly(focusTime),
    subscribeFocus,
    overlapNodes: shallowReadonly(overlapNodes),
    missNodeSize,
    focusPosition: shallowReadonly(focusPosition),
    updatePosition,
    closeOverlap,
    trackData: shallowReadonly(trackData),
    trackShow: shallowReadonly(trackShow),
    showTrack,
    closeTrack,
    clearTrack,
  };
});
export const useSharedSnapshotHoverImg = createSharedComposable(() => {
  const { updatePosition, focusNode } = useSnapshotStore();

  const imgRef = shallowRef<HTMLImageElement>();
  const imgBounding = useElementBounding(imgRef);
  const imgLoadTime = shallowRef(false);

  const clickImg = (ev: MouseEvent) => {
    const img = imgRef.value;
    if (!img) {
      return;
    }

    const imgRect = img.getBoundingClientRect();

    const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
    const offsetTop = (imgRect.height - innerHeight) / 2;

    const x = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
    const y =
      ((ev.clientY - imgRect.top - offsetTop) / innerHeight) *
      img.naturalHeight;

    updatePosition({ x, y });
  };

  const percent = (n: number) => {
    return `${n * 100}%`;
  };

  const imgSize = useElementSize(imgRef);

  const positionStyle = computed(() => {
    const img = imgRef.value;

    const attr = focusNode.value?.attr;
    if (!focusNode.value || !img || !attr || !imgLoadTime.value) {
      return ``;
    }
    const imgWidth = imgSize.width.value;
    const imgHeight = imgSize.height.value;
    const innerHeight = (imgWidth / img.naturalWidth) * img.naturalHeight;
    return {
      left: `calc(${percent(attr.left / img.naturalWidth)} - 2px)`,
      width: `calc(${percent(
        (attr.right - attr.left) / img.naturalWidth,
      )} + 2px)`,

      top: `calc(${percent(
        ((attr.top / img.naturalHeight) * innerHeight +
          (imgHeight - innerHeight) / 2) /
          imgHeight,
      )} - 2px)`,
      height: `calc(${percent(
        (((attr.bottom - attr.top) / img.naturalHeight) * innerHeight) /
          imgHeight,
      )} + 2px)`,
    };
  });
  const imgHover = shallowRef(false);
  const hoverPosition = shallowRef({ ox: 0, oy: 0 });
  const boxHoverPosition = computed(() => {
    const attr = focusNode.value?.attr;
    if (!attr) {
      return;
    }
    const { ox, oy } = hoverPosition.value;
    return {
      left: ox - attr.left,
      right: attr.right - ox,
      top: oy - attr.top,
      bottom: attr.bottom - oy,
    };
  });
  const boxHoverPerPosition = computed(() => {
    const attr = focusNode.value?.attr;
    if (!attr || !boxHoverPosition.value) {
      return;
    }
    if (attr.width <= 0 || attr.height <= 0) {
      return;
    }
    const { bottom, left, right, top } = boxHoverPosition.value;
    return {
      left: toFixedNumber(left / (right + left), 3),
      right: toFixedNumber(right / (right + left), 3),
      top: toFixedNumber(top / (top + bottom), 3),
      bottom: toFixedNumber(bottom / (top + bottom), 3),
    };
  });
  const hoverBgImgWidth = 1000;
  const hoverPositionStyle = shallowRef({
    left: '0',
    top: '0',
    width: hoverBgImgWidth + 'px',
  });

  const imgMove = (ev: MouseEvent) => {
    const img = imgRef.value;
    if (!img) return;
    const imgRect = img.getBoundingClientRect();

    const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
    const offsetTop = (imgRect.height - innerHeight) / 2;

    const ox = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
    const oy =
      ((ev.clientY - imgRect.top - offsetTop) / innerHeight) *
      img.naturalHeight;
    hoverPosition.value = { ox, oy };
    hoverPositionStyle.value = {
      left:
        (-(ox - 0.1 * img.naturalWidth) / img.naturalWidth) * hoverBgImgWidth +
        'px',
      top:
        (-(oy - 0.1 * img.naturalWidth) / img.naturalWidth) * hoverBgImgWidth +
        'px',
      width: hoverBgImgWidth + 'px',
    };
  };
  return {
    imgRef,
    imgBounding,
    clickImg,
    positionStyle,
    imgHover,
    imgMove,
    hoverPositionStyle,
    boxHoverPerPosition,
    imgLoadTime,
    hoverPosition,
    boxHoverPosition,
  };
});
