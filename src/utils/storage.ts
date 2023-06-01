import type { Snapshot } from '@/utils/types';
import localforage from 'localforage';
import { reactive, toRaw, watch } from 'vue';
import type { GithubPoliciesAsset } from './github';

const snapshotStore = localforage.createInstance({
  version: 1,
  driver: localforage.INDEXEDDB,
  name: `snapshot`,
});
const screenshotStore = localforage.createInstance({
  version: 1,
  driver: localforage.INDEXEDDB,
  name: `screenshot`,
});

export const storage = {
  setSnapshot: async (p: Snapshot) => {
    return snapshotStore.setItem(p.id.toString(), p);
  },
  deleteSnapshot: async (snapshotId: number | string) => {
    await Promise.all([
      snapshotStore.removeItem(snapshotId.toString()),
      screenshotStore.removeItem(snapshotId.toString()),
    ]);
  },
  getSnapshot: async (snapshotId: number | string) => {
    return snapshotStore.getItem<Snapshot>(snapshotId.toString());
  },
  hasSnapshot: async (snapshotId: number | string) => {
    return (await snapshotStore.keys()).includes(snapshotId.toString());
  },
  getAllSnapshots: async () => {
    return Promise.all(
      (await snapshotStore.keys()).map(
        (k) => snapshotStore.getItem(k) as Promise<Snapshot>,
      ),
    );
  },

  hasScreenshot: async (snapshotId: number | string) => {
    return (await screenshotStore.keys()).includes(snapshotId.toString());
  },
  setScreenshot: async (snapshotId: number | string, p: ArrayBuffer) => {
    return screenshotStore.setItem(snapshotId.toString(), p);
  },
  getScreenshot: async (snapshotId: number | string) => {
    return screenshotStore.getItem<ArrayBuffer>(snapshotId.toString());
  },
};

const useAsyncStore = <T extends object>(
  key: string,
  initialValue: (() => T) | T,
) => {
  const store = reactive<T>(
    typeof initialValue == 'function' ? initialValue() : initialValue,
  );
  let storeInited = false;
  watch(store, async () => {
    if (!storeInited) return;
    await localforage.setItem(key, toRaw(store));
  });
  localforage.getItem(key).then((r) => {
    r && Object.assign(store, r);
    storeInited = true;
  });
  return store;
};

export const importStore = useAsyncStore<Record<string, number>>(
  `importStore`,
  {},
);

export const exportPngStore = useAsyncStore<
  Record<number, GithubPoliciesAsset>
>(`exportPngStore`, {});
export const exportZipStore = useAsyncStore<
  Record<number, GithubPoliciesAsset>
>(`exportZipStore`, {});
