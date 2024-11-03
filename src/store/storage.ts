import { isIntString } from '@/utils/others';
import { getImageId, getImportId } from '@/utils/url';

import localforage from 'localforage';
import type { Reactive } from 'vue';

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}

interface InitHelper<T> {
  waitInit: () => Promise<Reactive<T>>;
  inited: globalThis.Ref<boolean>;
}

const useAsyncReactiveStorage = <T extends object>(
  key: string,
  initialValue: () => T,
  transform?: (v: T) => T,
) => {
  const data = reactive(initialValue());
  const inited = ref(false);
  watch(data, async () => {
    if (!inited.value) {
      return;
    }
    await localforage.setItem(key, toRaw(data));
  });
  const task = localforage.getItem(key).then(async (r) => {
    if (r && typeof r === 'object') {
      if (transform) {
        r = transform(r as T);
      }
      Object.assign(data, r);
      await nextTick();
    }
    inited.value = true;
  });
  const waitInit = async () => {
    if (!inited.value) {
      await task;
    }
    return data;
  };
  const init: InitHelper<T> = {
    waitInit,
    inited,
  };
  return {
    data,
    init,
  };
};

interface SettingsState {
  autoUploadImport: boolean;
  ignoreUploadWarn: boolean;
  ignoreWasmWarn: boolean;
  maxShowNodeSize: number;
}

export const useSettingsStore = defineStore('settings', () => {
  const { data, init } = useAsyncReactiveStorage<SettingsState>(
    'settings',
    () => ({
      autoUploadImport: false,
      ignoreUploadWarn: false,
      ignoreWasmWarn: false,
      maxShowNodeSize: 2000,
    }),
  );
  return {
    ...toRefs(data),
    ...init,
  };
});

export const useStorageStore = defineStore('storage', () => {
  // snapshot id -> import time
  const snapshotImportTime = useAsyncReactiveStorage<Record<string, number>>(
    'importTime',
    () => ({}),
  );

  // snapshot id -> github image id
  const snapshotImageId = useAsyncReactiveStorage<Record<string, string>>(
    'githubJpg',
    () => ({}),
    (obj) => {
      Object.keys(obj).forEach((key) => {
        const v = obj[key];
        if (v.startsWith('https://')) {
          delete obj[key];
          const imageId = getImageId(v);
          if (imageId) {
            obj[key] = imageId;
          }
        }
      });
      return obj;
    },
  );

  // snapshot id -> import id
  const snapshotImportId = useAsyncReactiveStorage<Record<string, number>>(
    'githubZip',
    () => ({}),
    (obj) => {
      // 转换旧数据
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
  const importSnapshotId = useAsyncReactiveStorage<Record<string, number>>(
    'url',
    () => ({}),
    (obj) => {
      // 转换旧数据
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

  const data = {
    snapshotImportTime,
    snapshotImageId,
    snapshotImportId,
    importSnapshotId,
  } as const;

  const inited = computed(() => {
    return Object.values(data).every((v) => v.init.inited.value);
  });
  const waitInit = async () => {
    if (inited.value) return;
    await Promise.all(Object.values(data).map((v) => v.init.waitInit()));
  };

  type Data = typeof data;
  type NewData = {
    [K in keyof Data]: Data[K]['data'];
  };

  const newData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      return [key, value.data];
    }),
  ) as NewData;

  return {
    inited,
    waitInit,
    ...newData,
  };
});
