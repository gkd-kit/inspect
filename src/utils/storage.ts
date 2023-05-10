import type { Snapshot, WindowData } from '@/utils/types';
import localforage from 'localforage';

localforage.config({
  driver: localforage.INDEXEDDB,
  version: 1,
});

const storage = {
  setSnapshot: async (p: Snapshot) => {
    return localforage.setItem(`snapshot-${p.id}`, p);
  },
  deleteSnapshot: async (snapshotId: number | string) => {
    await Promise.any(
      [
        `snapshot-${snapshotId}`,
        `windw-${snapshotId}`,
        `screenshot-${snapshotId}`,
      ].map((d) => localforage.removeItem(d))
    );
  },
  getSnapshot: async (snapshotId: number | string) => {
    return localforage.getItem<Snapshot>(`snapshot-${snapshotId}`);
  },
  getAllSnapshots: async () => {
    return Promise.all(
      (await localforage.keys())
        .filter((k) => k.startsWith(`snapshot-`))
        .map((k) => localforage.getItem(k) as Promise<Snapshot>)
    );
  },
  setWindow: async (snapshotId: number | string, p: WindowData) => {
    return localforage.setItem(`windw-${snapshotId}`, p);
  },
  getWindow: async (snapshotId: number | string) => {
    return localforage.getItem<WindowData>(`windw-${snapshotId}`);
  },
  setScreenshot: async (snapshotId: number | string, p: ArrayBuffer) => {
    return localforage.setItem(`screenshot-${snapshotId}`, p);
  },
  getScreenshot: async (snapshotId: number | string) => {
    return localforage.getItem<ArrayBuffer>(`screenshot-${snapshotId}`);
  },
};
export default storage;
