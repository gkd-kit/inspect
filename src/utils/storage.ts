import localforage from 'localforage';
import { reactive, toRaw, watch } from 'vue';
import type { Snapshot } from './types';
import { getImportId } from './url';

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

export const dataInitTasks: Promise<void>[] = [];

const useReactiveStorage = <T extends object>(
  key: string,
  initialValue: T,
  transform?: (v: T) => T,
) => {
  const store = reactive(initialValue);
  let storeInited = false;
  watch(store, async () => {
    if (!storeInited) return;
    await localforage.setItem(key, toRaw(store));
  });
  const task = localforage.getItem(key).then((r) => {
    if (r) {
      if (transform) {
        r = transform(r as T);
      }
      Object.assign(store, r);
    }
    storeInited = true;
  });
  dataInitTasks.push(task);
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
    // @ts-ignore
    importTimeStorage[key] && delete importTimeStorage[key],
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
  Object.entries(urlStorage).forEach(([k, v]) => {
    if (v == snapshot.id) {
      delete urlStorage[k];
    }
  });
  if (githubJpgStorage[snapshot.id]) {
    delete githubJpgStorage[snapshot.id];
  }
  if (importStorage[snapshot.id]) {
    delete importStorage[snapshot.id];
  }
  importTimeStorage[snapshot.id] = Date.now();
  await Promise.all([
    snapshotStorage.setItem(snapshot.id, snapshot),
    screenshotStorage.setItem(snapshot.id, bf),
  ]);
};

export const cacheStorage = useStorage({
  name: `cache`,
  version: 1,
});

const isIntString = (v: string | number) => {
  if (typeof v === 'number') return true;
  if (!v) return false;
  return Array.prototype.every.call(v, (c) => '0' <= c && c <= '9');
};

/**
 * key: import id
 *
 * value: snapshot id
 */
export const urlStorage = useReactiveStorage<Record<string, number>>(
  `url`,
  {},
  (obj) => {
    // 转换旧数据
    Object.keys(obj).forEach((url) => {
      if (isIntString(url)) {
        return;
      }
      const importId = getImportId(url);
      if (importId) {
        obj[importId] = obj[url];
      }
      delete obj[url];
    });
    return obj;
  },
);

export const importTimeStorage = useReactiveStorage<Record<number, number>>(
  'importTime',
  {},
);

export const githubJpgStorage = useReactiveStorage<Record<number, string>>(
  `githubJpg`,
  {},
);

/**
 * key: snapshot id
 *
 * value: import id
 */
export const importStorage = useReactiveStorage<
  Record<number | string, number>
>(`githubZip`, {}, (obj) => {
  // 转换旧数据
  Object.entries(obj).forEach(([k, _v]) => {
    const v = _v as unknown as string;
    if (isIntString(v)) {
      return;
    }
    const n1 = getImportId(v);
    if (n1) {
      obj[k] = +n1;
    } else {
      delete obj[k];
    }
  });
  return obj;
});

export const settingsStorage = useReactiveStorage<{
  autoUploadImport: boolean;
  ignoreUploadWarn: boolean;
  ignoreWasmWarn: boolean;
}>('settings', {
  autoUploadImport: false,
  ignoreUploadWarn: false,
  ignoreWasmWarn: false,
});

const snapshotsKey = 'snapshots-cache-version';
const snapshotsVersion = 'v2';
if (localStorage.getItem(snapshotsKey) !== snapshotsVersion) {
  localStorage.setItem(snapshotsKey, snapshotsVersion);
  Promise.all(dataInitTasks).then(async () => {
    const r = await fetch(
      `https://registry.npmmirror.com/@gkd-kit/assets/latest/files/assets/snapshots-${snapshotsVersion}.json`,
    );
    const list: { id: number; import_id: number }[] = await r.json();
    list.forEach((item) => {
      if (!importStorage[item.id]) {
        importStorage[item.id] = item.import_id;
      }
      if (!urlStorage[item.import_id]) {
        urlStorage[item.import_id] = item.id;
      }
    });
  });
}
