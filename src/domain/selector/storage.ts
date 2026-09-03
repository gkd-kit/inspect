import localforage from 'localforage';
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

interface SelectorLibraryStateSyncOptions {
  load: () => Promise<SelectorPreset[]>;
  update: (updater: SelectorLibraryStorageUpdater) => Promise<SelectorPreset[]>;
  apply: (items: SelectorPreset[]) => void;
  broadcast: () => void;
}

export const createSelectorLibraryStateSync = (
  options: SelectorLibraryStateSyncOptions,
) => {
  let refreshRevision = 0;
  let pendingCommitCount = 0;
  let refreshRequested = false;

  const refresh = async (): Promise<void> => {
    if (pendingCommitCount > 0) {
      refreshRequested = true;
      return;
    }
    const revision = ++refreshRevision;
    const items = await options.load();
    if (pendingCommitCount > 0) {
      refreshRequested = true;
    } else if (revision == refreshRevision) {
      options.apply(items);
    }
  };

  const commit = async (updater: SelectorLibraryStorageUpdater) => {
    pendingCommitCount += 1;
    refreshRevision += 1;
    try {
      const items = await options.update(updater);
      options.apply(items);
      options.broadcast();
      return items;
    } finally {
      pendingCommitCount -= 1;
      if (pendingCommitCount == 0 && refreshRequested) {
        refreshRequested = false;
        void refresh().catch(() => undefined);
      }
    }
  };

  return { commit, refresh };
};
