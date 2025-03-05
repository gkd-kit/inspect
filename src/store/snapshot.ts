import {
  detectSnapshot,
  exportSnapshotAsImageId,
  exportSnapshotAsImportId,
} from '@/utils/export';
import { gmOk } from '@/utils/gm';
import { findNodesByXy, getAppInfo, listToTree } from '@/utils/node';
import { toInteger } from '@/utils/others';
import type { ResolvedSelector } from '@/utils/selector';
import { screenshotStorage, snapshotStorage } from '@/utils/snapshot';
import { useTask } from '@/utils/task';
import type {
  Position,
  RawNode,
  Snapshot,
  TrackCardProps,
} from '@/utils/types';
import type { QueryResult } from '@gkd-kit/selector';

const getRemoteImportId = async (id: number): Promise<number> => {
  return fetch('https://detect.gkd.li/api/getImportId?id=' + id)
    .then((r) => r.json())
    .catch(() => 0);
};

export const useSnapshotStore = defineStore('snapshot', () => {
  const route = useRoute();
  const router = useRouter();
  const settingsStore = useSettingsStore();
  const storageStore = useStorageStore();
  const { snapshotImportId, snapshotImageId, importSnapshotId } = storageStore;

  const snapshotId = shallowRef<number>();
  watchImmediate(
    () => route.params.snapshotId,
    (v) => {
      snapshotId.value = toInteger(v);
    },
  );
  const importId = computed(() => {
    if (snapshotId.value) return snapshotImportId[snapshotId.value];
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
      return URL.createObjectURL(
        new Blob([screenshot.value], {
          type: 'image/png',
        }),
      );
    }
    return undefined;
  });
  const redirected = shallowRef(false);
  const update = useTask(async (id: number | undefined) => {
    redirected.value = false;
    if (!id) {
      snapshot.value = undefined;
      screenshot.value = undefined;
      return;
    }
    await Promise.all([
      snapshotStorage.getItem(id).then((r) => {
        snapshot.value = r || undefined;
      }),
      screenshotStorage.getItem(id).then((r) => {
        screenshot.value = r || undefined;
      }),
    ]);
    if (!snapshot.value) {
      const remoteImportId =
        snapshotImportId[id] || (await getRemoteImportId(id));
      if (remoteImportId && Number.isSafeInteger(remoteImportId)) {
        redirected.value = true;
        router.replace({
          path: '/i/' + remoteImportId,
          query: route.query,
        });
        return;
      }
    }
  });
  const loading = computed(() => update.loading);
  watchImmediate(() => snapshotId.value, update.invoke);
  watchEffect(() => {
    if (
      importId.value &&
      storageStore.inited &&
      !importSnapshotId[importId.value] &&
      snapshotId.value
    ) {
      importSnapshotId[importId.value] = snapshotId.value;
      fetch(
        `https://detect.gkd.li/api/detectSnapshot?importId=` + importId.value,
      );
    }
  });
  const autoUpload = computed(() => {
    return (
      gmOk() &&
      settingsStore.inited &&
      settingsStore.autoUploadImport &&
      storageStore.inited
    );
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
    if (snapshot.value && settingsStore.inited) {
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
    }
  };

  const trackShow = ref(false);
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

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}
