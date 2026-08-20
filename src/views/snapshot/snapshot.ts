import {
  detectSnapshot,
  exportSnapshotAsImageId,
  exportSnapshotAsImportId,
} from '@/utils/export';
import { gmOk } from '@/utils/gm';
import { importFromNetwork } from '@/utils/import';
import { findNodesByXy, getAppInfo, listToTree } from '@/utils/node';
import { toFixedNumber, toInteger } from '@/utils/others';
import type { ResolvedSelector } from '@/utils/selector';
import { screenshotStorage, snapshotStorage } from '@/utils/snapshot';
import { useTask } from '@/utils/task';
import { getImportFileUrl } from '@/utils/url';
import { getSnapshotImportId } from '@/utils/workers';
import type { QueryResult } from '@gkd-kit/selector';

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}

type SnapshotRouteSource =
  | { type: 'snapshot'; snapshotId: number }
  | { type: 'import'; importId: number }
  | undefined;

const getGithubAssetId = (v: unknown): number | undefined => {
  return toInteger(String(v).match(/^\d+/)?.[0]);
};

export const useSnapshotStore = createSharedComposable(() => {
  const route = useRoute();
  const router = useRouter();

  const routeSource = computed<SnapshotRouteSource>(() => {
    const snapshotId = toInteger(route.params.snapshotId);
    if (snapshotId) {
      return { type: 'snapshot', snapshotId };
    }
    const importId = getGithubAssetId(route.params.github_asset_id);
    if (importId) {
      return { type: 'import', importId };
    }
    return undefined;
  });
  const snapshotId = shallowRef<number>();
  const importId = computed(() => {
    if (snapshotId.value) {
      return snapshotImportId[snapshotId.value];
    }
    if (routeSource.value?.type == 'import') {
      return routeSource.value.importId;
    }
    return undefined;
  });
  const imageId = computed(() => {
    if (snapshotId.value) return snapshotImageId[snapshotId.value];
    return undefined;
  });
  const snapshot = shallowRef<Snapshot>();
  watchEffect(() => {
    if (snapshot.value) {
      document.title =
        '快照-' + (getAppInfo(snapshot.value).name || snapshot.value.appId);
    }
  });
  const screenshot = shallowRef<ArrayBuffer>();
  const screenshotUrl = computed(() => {
    if (screenshot.value) {
      return URL.createObjectURL(new Blob([screenshot.value]));
    }
    return undefined;
  });
  const redirected = shallowRef(false);
  const resetSnapshot = () => {
    snapshotId.value = undefined;
    snapshot.value = undefined;
    screenshot.value = undefined;
  };
  const loadLocalSnapshot = async (id: number) => {
    snapshotId.value = id;
    const [localSnapshot, localScreenshot] = await Promise.all([
      snapshotStorage.getItem(id),
      screenshotStorage.getItem(id),
    ]);
    snapshot.value = localSnapshot || undefined;
    screenshot.value = localSnapshot ? localScreenshot || undefined : undefined;
    return Boolean(localSnapshot);
  };
  const findSnapshotIdByImportId = (id: number) => {
    const entry = Object.entries(snapshotImportId).find(([, v]) => v == id);
    return toInteger(entry?.[0]);
  };
  const loadImportSnapshot = async (id: number) => {
    const localSnapshotId =
      importSnapshotId[id] || findSnapshotIdByImportId(id);
    if (localSnapshotId) {
      const hasSnapshot = await loadLocalSnapshot(localSnapshotId);
      if (hasSnapshot) {
        importSnapshotId[id] = localSnapshotId;
        snapshotImportId[localSnapshotId] = id;
        return true;
      }
      delete importSnapshotId[id];
      if (snapshotImportId[localSnapshotId] == id) {
        delete snapshotImportId[localSnapshotId];
      }
    }

    const [remoteSnapshot] =
      (await importFromNetwork(getImportFileUrl(id))) || [];
    if (remoteSnapshot?.id) {
      importSnapshotId[id] = remoteSnapshot.id;
      snapshotImportId[remoteSnapshot.id] = id;
      await loadLocalSnapshot(remoteSnapshot.id);
      return true;
    }
    resetSnapshot();
    return false;
  };
  const update = useTask(async (source: SnapshotRouteSource) => {
    redirected.value = false;
    if (!source) {
      resetSnapshot();
      return;
    }

    if (source.type == 'snapshot') {
      const hasSnapshot = await loadLocalSnapshot(source.snapshotId);
      const localImportId = snapshotImportId[source.snapshotId];
      if (localImportId) {
        importSnapshotId[localImportId] = source.snapshotId;
        redirected.value = !hasSnapshot;
        router.replace({
          path: '/i/' + localImportId,
          query: route.query,
        });
        if (!hasSnapshot) {
          await loadImportSnapshot(localImportId);
          redirected.value = false;
        }
        return;
      }

      if (!hasSnapshot) {
        const remoteImportId = await getSnapshotImportId(
          source.snapshotId,
        ).catch(() => null);
        if (remoteImportId && Number.isSafeInteger(remoteImportId)) {
          redirected.value = true;
          router.replace({
            path: '/i/' + remoteImportId,
            query: route.query,
          });
          await loadImportSnapshot(remoteImportId);
          redirected.value = false;
          return;
        }
      }
      return;
    }

    await loadImportSnapshot(source.importId);
  });
  const loading = computed(() => update.loading);
  watchImmediate(() => routeSource.value, update.invoke);
  watchEffect(() => {
    if (routeSource.value?.type == 'snapshot' && importId.value) {
      router.replace({
        path: '/i/' + importId.value,
        query: route.query,
      });
    }
  });
  watchEffect(() => {
    if (
      importId.value &&
      !importSnapshotId[importId.value] &&
      snapshotId.value
    ) {
      detectSnapshot(snapshotId.value, importId.value);
    }
  });
  const autoUpload = computed(() => {
    return gmOk() && settingsStore.autoUploadImport;
  });
  watchEffect(() => {
    if (autoUpload.value && snapshot.value && !imageId.value) {
      exportSnapshotAsImageId(snapshot.value);
    }
    if (autoUpload.value && snapshot.value && !importId.value) {
      exportSnapshotAsImportId(snapshot.value);
    }
    if (autoUpload.value && snapshot.value && importId.value) {
      detectSnapshot(snapshot.value.id, importId.value);
    }
  });
  const nodes = computed(() => {
    if (snapshot.value) {
      if (snapshot.value.nodes.length <= settingsStore.maxShowNodeSize) {
        return structuredClone(snapshot.value.nodes);
      } else {
        return structuredClone(
          snapshot.value.nodes.slice(0, settingsStore.maxShowNodeSize),
        );
      }
    }
    return [];
  });
  const rootNode = computed(() => {
    if (nodes.value.length) {
      return listToTree(nodes.value);
    }
    return undefined;
  });
  const missNodeSize = computed(() => {
    if (snapshot.value) {
      return snapshot.value.nodes.length - settingsStore.maxShowNodeSize;
    }
    return 0;
  });
  const focusNode = shallowRef<RawNode>();
  const focusTime = shallowRef(0);
  const focusPosition = shallowRef<Position>();
  const overlapNodes = shallowRef<RawNode[]>();
  const updateFocusNode = async (node: RawNode) => {
    focusNode.value = node;
    focusTime.value = Date.now();
    await nextTick();
    if (overlapNodes.value && !overlapNodes.value.includes(node)) {
      focusPosition.value = undefined;
      overlapNodes.value = undefined;
    }
  };
  watchEffect(() => {
    if (rootNode.value) {
      updateFocusNode(rootNode.value);
    }
  });
  const updatePosition = (position: Position) => {
    focusPosition.value = position;
    const resultNodes = findNodesByXy(nodes.value, focusPosition.value);
    if (resultNodes.length) {
      updateFocusNode(resultNodes[0]);
    }
    if (resultNodes.length > 1) {
      overlapNodes.value = resultNodes;
    } else {
      overlapNodes.value = undefined;
    }
  };

  const trackShow = shallowRef(false);
  const trackData = shallowRef<TrackCardProps>();
  const showTrack = (
    selector: ResolvedSelector,
    result: QueryResult<RawNode>,
  ) => {
    trackShow.value = true;
    trackData.value = {
      selector,
      nodes: nodes.value,
      queryResult: result,
    };
  };

  return {
    snapshotId,
    snapshot,
    rootNode,
    screenshotUrl,
    loading,
    redirected,
    importId,
    imageId,
    focusNode,
    updateFocusNode,
    focusTime,
    overlapNodes,
    missNodeSize,
    focusPosition,
    updatePosition,
    trackData,
    trackShow,
    showTrack,
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
