import { useLatestTask, useSerialTask } from '@/shared/lib/latest_task';
import localforage from 'localforage';
import {
  parseLibraryBackup,
  serializeLibraryBackup,
  type SelectorLibraryState,
} from '../../entities/selector-library/sync.ts';
import {
  parseSelectorLibraryPayload,
  serializeSelectorLibrary,
  type SelectorPreset,
} from './library.ts';

const SELECTOR_LIBRARY_INDEXED_STORAGE_KEY = 'v1';
export const SELECTOR_LIBRARY_SYNC_NAMESPACE = 'selectorLibrary.presets.v1';

export interface SelectorLibraryIndexedStorage {
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<unknown>;
}

type SelectorLibraryStorageUpdater = (
  items: readonly SelectorPreset[],
) => SelectorPreset[];

const indexedStorage: SelectorLibraryIndexedStorage =
  localforage.createInstance({
    name: 'selectorLibrary',
    storeName: 'presets',
    version: 1,
    driver: localforage.INDEXEDDB,
  });

let fallbackUpdateQueue: Promise<void> = Promise.resolve();

const runWithFallbackQueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = fallbackUpdateQueue.then(operation, operation);
  fallbackUpdateQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const runStorageOperationExclusive = <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  if (typeof navigator != 'undefined' && navigator.locks) {
    return navigator.locks.request(SELECTOR_LIBRARY_SYNC_NAMESPACE, operation);
  }
  return runWithFallbackQueue(operation);
};

const parseIndexedValue = (value: unknown): SelectorPreset[] => {
  if (value == null) return [];
  try {
    return parseSelectorLibraryPayload(value);
  } catch {
    return [];
  }
};

export const loadSelectorLibraryFromStorage = async (
  storage: SelectorLibraryIndexedStorage = indexedStorage,
): Promise<SelectorPreset[]> =>
  parseIndexedValue(
    await storage.getItem(SELECTOR_LIBRARY_INDEXED_STORAGE_KEY),
  );

export const persistSelectorLibraryToStorage = async (
  items: readonly SelectorPreset[],
  storage: SelectorLibraryIndexedStorage = indexedStorage,
): Promise<void> => {
  await storage.setItem(
    SELECTOR_LIBRARY_INDEXED_STORAGE_KEY,
    serializeSelectorLibrary(items),
  );
};

export const updateSelectorLibraryInStorage = async (
  updater: SelectorLibraryStorageUpdater,
  storage: SelectorLibraryIndexedStorage = indexedStorage,
): Promise<SelectorPreset[]> =>
  runStorageOperationExclusive(async () => {
    const current = await loadSelectorLibraryFromStorage(storage);
    const next = updater(current);
    await persistSelectorLibraryToStorage(next, storage);
    return next;
  });

export const loadLibraryState = async (
  storage: SelectorLibraryIndexedStorage = indexedStorage,
): Promise<SelectorLibraryState> => {
  const value = await storage.getItem(SELECTOR_LIBRARY_INDEXED_STORAGE_KEY);
  return value == null ? { items: [], sources: [] } : parseLibraryBackup(value);
};

export const updateLibraryState = async (
  updater: (state: SelectorLibraryState) => SelectorLibraryState,
  storage: SelectorLibraryIndexedStorage = indexedStorage,
): Promise<SelectorLibraryState> =>
  runStorageOperationExclusive(async () => {
    const current = await loadLibraryState(storage);
    const state = updater(current);
    if (state === current) return current;
    await storage.setItem(
      SELECTOR_LIBRARY_INDEXED_STORAGE_KEY,
      serializeLibraryBackup(state),
    );
    return state;
  });

interface SelectorLibraryStateSyncOptions<T> {
  load: () => Promise<T>;
  update: (updater: (state: T) => T) => Promise<T>;
  apply: (items: T) => void;
  broadcast: () => void;
}

export const createSelectorLibraryStateSync = <T = SelectorPreset[]>(
  options: SelectorLibraryStateSyncOptions<T>,
) => {
  let refreshRequested = false;
  const refreshTask = useLatestTask(async ({ commit }) => {
    const items = await options.load();
    if (writeTask.loading.value) refreshRequested = true;
    else
      commit(() => {
        options.apply(items);
      });
  });
  const writeTask = useSerialTask(
    async ({ commit }, updater: (state: T) => T) => {
      let changed = false;
      const items = await options.update((current) => {
        const next = updater(current);
        changed = next !== current;
        return next;
      });
      commit(() => {
        options.apply(items);
      });
      if (changed) options.broadcast();
      return items;
    },
  );
  const refresh = async (): Promise<void> => {
    if (writeTask.loading.value) {
      refreshRequested = true;
      return;
    }
    const result = await refreshTask.run();
    if (result.status === 'error') throw result.error;
  };
  const commit = async (updater: (state: T) => T): Promise<T> => {
    if (refreshTask.loading.value) refreshRequested = true;
    refreshTask.cancel();
    const result = await writeTask.run(updater);
    if (!writeTask.loading.value && refreshRequested) {
      refreshRequested = false;
      void refresh().catch(() => undefined);
    }
    if (result.status === 'error') throw result.error;
    return result.value;
  };
  return { commit, refresh };
};
