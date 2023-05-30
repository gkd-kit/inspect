import type { Snapshot } from '@/utils/types';
import localforage from 'localforage';

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

const importStore = localforage.createInstance({
  version: 1,
  driver: localforage.INDEXEDDB,
  name: `import`,
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
  getImportId: async (url: string) => {
    return importStore.getItem<number>(url);
  },
  setImportId: async (url: string, p: number) => {
    return importStore.setItem<number>(url, p);
  },
  deleteImportId: async (url: string) => {
    return importStore.removeItem(url);
  },
};
