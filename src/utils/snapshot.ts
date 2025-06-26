import localforage from 'localforage';

const useStorage = <T>(options: LocalForageOptions = {}) => {
  options.driver ??= localforage.INDEXEDDB;
  const storage = localforage.createInstance(options);
  const setItem = async (key: string | number, value: T) => {
    return storage.setItem(key.toString(), value);
  };
  const getItem = async (key: string | number) => {
    return storage.getItem<T>(key.toString());
  };
  const getAllItems = async (): Promise<T[]> => {
    return Promise.all(
      (await storage.keys()).map((k) => storage.getItem(k) as Promise<T>),
    );
  };
  const removeItem = async (key: string | number) => {
    return storage.removeItem(key.toString());
  };

  const hasItem = async (key: string | number) => {
    const keyStr = key.toString();
    return storage.keys().then((r) => r.includes(keyStr));
  };
  const keys = async () => {
    return storage.keys();
  };

  return {
    keys,
    hasItem,
    getItem,
    setItem,
    removeItem,
    getAllItems,
  };
};

export const snapshotStorage = useStorage<Snapshot>({
  name: `snapshot`,
  version: 1,
});

const snapshotSetItem = snapshotStorage.setItem;
snapshotStorage.setItem = async (key, value) => {
  const shallowValue = { ...value, nodes: [] };
  await shallowSnapshotStorage.setItem(key, shallowValue);
  return snapshotSetItem(key, value);
};

const snapshotRemoveItem = snapshotStorage.removeItem;
snapshotStorage.removeItem = async (key) => {
  await Promise.all([
    snapshotRemoveItem(key),
    shallowSnapshotStorage.removeItem(key),
    screenshotStorage.removeItem(key),
    snapshotImportTime[key] && delete snapshotImportTime[key],
  ]);
};

export const shallowSnapshotStorage = useStorage<Snapshot>({
  name: `shallowSnapshot`,
  version: 1,
});

export const screenshotStorage = useStorage<ArrayBuffer>({
  name: `screenshot`,
  version: 1,
});

export const setSnapshot = async (snapshot: Snapshot, bf: ArrayBuffer) => {
  Object.entries(importSnapshotId).forEach(([k, v]) => {
    if (v == snapshot.id) {
      delete importSnapshotId[k];
    }
  });
  if (snapshotImageId[snapshot.id]) {
    delete snapshotImageId[snapshot.id];
  }
  if (snapshotImportId[snapshot.id]) {
    delete snapshotImportId[snapshot.id];
  }
  snapshotImportTime[snapshot.id] = Date.now();
  await Promise.all([
    snapshotStorage.setItem(snapshot.id, snapshot),
    screenshotStorage.setItem(snapshot.id, bf),
  ]);
};
