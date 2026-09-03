import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSelectorLibraryStateSync,
  loadSelectorLibraryFromStorage,
  persistSelectorLibraryToStorage,
  updateSelectorLibraryInStorage,
  type SelectorLibraryIndexedStorage,
} from './storage.ts';
import { createSelectorPreset, serializeSelectorLibrary } from './library.ts';

const now = 1_700_000_000_000;

const createIndexedStorage = (initialValue: unknown = null) => {
  let value = initialValue;
  const writes: { key: string; value: unknown }[] = [];
  const storage: SelectorLibraryIndexedStorage = {
    async getItem() {
      return value;
    },
    async setItem(key, nextValue) {
      value = nextValue;
      writes.push({ key, value: nextValue });
      return nextValue;
    },
  };
  return { storage, writes, getValue: () => value };
};

const createPreset = (id: string, name: string) =>
  createSelectorPreset(
    { name, selector: `[text="${name}"]`, scope: 'global' },
    id,
    now,
  );

test('loads the selector library from IndexedDB', async () => {
  const indexedPreset = createPreset('indexed', '新收藏');
  const indexed = createIndexedStorage(
    serializeSelectorLibrary([indexedPreset]),
  );

  const items = await loadSelectorLibraryFromStorage(indexed.storage);

  assert.deepEqual(items, [indexedPreset]);
  assert.equal(indexed.writes.length, 0);
});

test('returns an empty selector library for missing or invalid IndexedDB data', async () => {
  const missing = createIndexedStorage();
  const invalid = createIndexedStorage({ version: 2, items: [] });

  assert.deepEqual(await loadSelectorLibraryFromStorage(missing.storage), []);
  assert.deepEqual(await loadSelectorLibraryFromStorage(invalid.storage), []);
});

test('persists a versioned selector library payload to IndexedDB', async () => {
  const preset = createPreset('saved', '已保存');
  const indexed = createIndexedStorage();

  await persistSelectorLibraryToStorage([preset], indexed.storage);

  assert.deepEqual(indexed.getValue(), serializeSelectorLibrary([preset]));
});

test('re-reads the latest IndexedDB value before every mutation', async () => {
  const base = createPreset('base', '基础');
  const added = createPreset('added', '新增');
  const indexed = createIndexedStorage(serializeSelectorLibrary([base]));

  await updateSelectorLibraryInStorage(
    (items) => [...items, added],
    indexed.storage,
  );
  await updateSelectorLibraryInStorage(
    (items) =>
      items.map((item) =>
        item.id == base.id ? { ...item, useCount: item.useCount + 1 } : item,
      ),
    indexed.storage,
  );

  const items = await loadSelectorLibraryFromStorage(indexed.storage);
  assert.deepEqual(
    items.map((item) => item.id),
    ['base', 'added'],
  );
  assert.equal(items[0].useCount, 1);
});

test('does not let an external refresh suppress a pending local commit', async () => {
  const base = createPreset('base', '基础');
  const external = createPreset('external', '外部');
  const local = createPreset('local', '本地');
  let stored = [base];
  let releaseUpdate!: () => void;
  let markUpdateStarted!: () => void;
  const updateStarted = new Promise<void>((resolve) => {
    markUpdateStarted = resolve;
  });
  const updateGate = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  let visible = stored;
  const sync = createSelectorLibraryStateSync({
    load: async () => stored,
    update: async (updater) => {
      markUpdateStarted();
      await updateGate;
      stored = updater(stored);
      return stored;
    },
    apply: (items) => {
      visible = items;
    },
    broadcast: () => undefined,
  });

  const commit = sync.commit((items) => [...items, local]);
  await updateStarted;
  stored = [base, external];
  await sync.refresh();
  releaseUpdate();
  await commit;
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(
    visible.map((item) => item.id),
    ['base', 'external', 'local'],
  );
});
