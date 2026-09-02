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

const loadLocalStorage = <T extends object>(
  key: string,
  fallback: () => T,
  getter: (v: any) => T = directReturn,
): T => {
  const str = localStorage.getItem(key);
  const initData = str
    ? tryRun(() => getter(JSON.parse(str)), fallback)
    : fallback();
  return shallowReactive(initData) as T;
};

const loadIndexedDB = async <T extends object>(
  key: string,
  fallback: () => T,
  getter: (v: any) => T = directReturn,
): Promise<T> => {
  const initData = await localforage.getItem(key);
  return shallowReactive(initData ? getter(initData) : fallback()) as T;
};

const settingsData = loadLocalStorage<SettingsStore>('settings', () => ({
  autoUploadImport: false,
  ignoreUploadWarn: false,
  maxShowNodeSize: 2000,
}));

// snapshot id -> import time
const snapshotImportTimeData = await loadIndexedDB<Record<string, number>>(
  'importTime',
  () => ({}),
);

// snapshot id -> github image id
const snapshotImageIdData = await loadIndexedDB<Record<string, string>>(
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
const snapshotImportIdData = await loadIndexedDB<Record<string, number>>(
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
const importSnapshotIdData = await loadIndexedDB<Record<string, number>>(
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

export const settingsStore = readonly(settingsData) as Readonly<SettingsStore>;
export const snapshotImportTime = readonly(snapshotImportTimeData) as Readonly<
  Record<string, number>
>;
export const snapshotImageId = readonly(snapshotImageIdData) as Readonly<
  Record<string, string>
>;
export const snapshotImportId = readonly(snapshotImportIdData) as Readonly<
  Record<string, number>
>;
export const importSnapshotId = readonly(importSnapshotIdData) as Readonly<
  Record<string, number>
>;

const persistSettings = () => {
  localStorage.setItem('settings', JSON.stringify(toRaw(settingsData)));
};
const persistRecord = (key: string, value: object) => {
  void localforage.setItem(key, toRaw(value));
};
const setRecordValue = <T>(
  record: Record<string, T>,
  storageKey: string,
  key: string | number,
  value: T | undefined,
) => {
  const normalizedKey = String(key);
  if (value === undefined) delete record[normalizedKey];
  else record[normalizedKey] = value;
  persistRecord(storageKey, record);
};

export const storageActions = {
  updateSettings(patch: Partial<SettingsStore>) {
    Object.assign(settingsData, patch);
    persistSettings();
  },
  setSnapshotImportTime(snapshotId: string | number, value?: number) {
    setRecordValue(snapshotImportTimeData, 'importTime', snapshotId, value);
  },
  setSnapshotImageId(snapshotId: string | number, value?: string) {
    setRecordValue(snapshotImageIdData, 'githubJpg', snapshotId, value);
  },
  setSnapshotImportId(snapshotId: string | number, value?: number) {
    setRecordValue(snapshotImportIdData, 'githubZip', snapshotId, value);
  },
  setImportSnapshotId(importId: string | number, value?: number) {
    setRecordValue(importSnapshotIdData, 'url', importId, value);
  },
};

export const useStorageStore = () => ({
  settingsStore,
  snapshotImportTime,
  snapshotImageId,
  snapshotImportId,
  importSnapshotId,
  storageActions,
});
