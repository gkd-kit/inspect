import { isIntString } from '@/utils/others';
import { getImageId, getImportId } from '@/utils/url';
import localforage from 'localforage';

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}

const directReturn = (v: any): any => v;
const tryRun = <T>(fn: () => T, fallback: () => T): T => {
  try {
    return fn();
  } catch {
    return fallback();
  }
};

const useReactiveStorage = <T extends object>(
  key: string,
  fallback: () => T,
  getter: (v: any) => T = directReturn,
): T => {
  const str = localStorage.getItem(key);
  const initData = str
    ? tryRun(() => getter(JSON.parse(str)), fallback)
    : fallback();
  const data = shallowReactive(initData);
  watch(data, () => {
    localStorage.setItem(key, JSON.stringify(toRaw(data)));
  });
  return data as T;
};

const useReactiveIndexedDB = async <T extends object>(
  key: string,
  fallback: () => T,
  getter: (v: any) => T = directReturn,
): Promise<T> => {
  const initData = await localforage.getItem(key);
  const data = shallowReactive(initData ? getter(initData) : fallback());
  watch(data, async () => {
    await localforage.setItem(key, toRaw(data));
  });
  return data as T;
};

export const settingsStore = useReactiveStorage<SettingsStore>(
  'settings',
  () => ({
    autoUploadImport: false,
    ignoreUploadWarn: false,
    ignoreWasmWarn: false,
    maxShowNodeSize: 2000,
  }),
);

// snapshot id -> import time
export const snapshotImportTime = await useReactiveIndexedDB<
  Record<string, number>
>('importTime', () => ({}));

// snapshot id -> github image id
export const snapshotImageId = await useReactiveIndexedDB<
  Record<string, string>
>(
  'githubJpg',
  () => ({}),
  (obj) => {
    Object.keys(obj).forEach((key) => {
      const v = obj[key];
      if (v.startsWith('https://')) {
        const imageId = getImageId(v);
        if (imageId) {
          obj[key] = imageId;
        } else {
          delete obj[key];
        }
      }
    });
    return obj;
  },
);

// snapshot id -> import id
export const snapshotImportId = await useReactiveIndexedDB<
  Record<string, number>
>(
  'githubZip',
  () => ({}),
  (obj) => {
    // 兼容旧数据
    Object.keys(obj).forEach((key) => {
      const v = obj[key] as unknown as string;
      if (isIntString(v)) {
        return;
      }
      const importId = getImportId(v);
      if (importId) {
        obj[key] = importId;
      } else {
        delete obj[key];
      }
    });
    return obj;
  },
);

//  import id -> snapshot id
export const importSnapshotId = await useReactiveIndexedDB<
  Record<string, number>
>(
  'url',
  () => ({}),
  (obj) => {
    // 兼容旧数据
    Object.keys(obj).forEach((key) => {
      if (isIntString(key)) {
        return;
      }
      const importId = getImportId(key);
      if (importId) {
        obj[importId] = obj[key];
      }
      delete obj[key];
    });
    return obj;
  },
);

export const useStorageStore = () => ({
  settingsStore,
  snapshotImportTime,
  snapshotImageId,
  snapshotImportId,
  importSnapshotId,
});
