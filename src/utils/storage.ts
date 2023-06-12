import localforage from 'localforage';
import { reactive, toRaw, watch } from 'vue';
import type { GithubPoliciesAsset } from './github';
import { Snapshot } from './types';

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

const useReactiveStorage = <T extends object>(
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
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, bf);
};

export const cacheStorage = useStorage({
  name: `cache`,
  version: 1,
});

export const urlStorage = useReactiveStorage<Record<string, number>>(`url`, {});

export const githubPngStorage = useReactiveStorage<
  Record<number, GithubPoliciesAsset>
>(`githubPng`, {});

export const githubZipStorage = useReactiveStorage<
  Record<number, GithubPoliciesAsset>
>(`githubZip`, {});
