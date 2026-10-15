import assert from 'node:assert/strict';
import test from 'node:test';
import { createSelectorPreset, serializeSelectorLibrary } from './library.ts';
import {
  applyImportPlan,
  createImportPlan,
  getSelectorSource,
  normalizeSourceUrl,
  parseLibraryBackup,
  replaceSourceItems,
  removeSelectorSource,
  serializeLibraryBackup,
  serializeSharedLibrary,
  type SelectorLibraryState,
  type SelectorSource,
} from '../../entities/selector-library/sync.ts';
import { loadLibraryState, updateLibraryState } from './storage.ts';
import { fetchSelectorLibrary } from './network.ts';
const preset = (id = 'remote', name = '关闭') =>
  createSelectorPreset(
    { name, selector: '[text="关闭"]', scope: 'global' },
    id,
    100,
  );
const empty = (): SelectorLibraryState => ({ items: [], sources: [] });
const source = (id = 'source'): SelectorSource => ({
  id,
  name: id,
  url: `https://example.com/${id}.json`,
  checkedAt: 0,
  entries: [],
});
const subscribed = () =>
  applyImportPlan(
    empty(),
    createImportPlan(empty(), [preset()], source(), 200),
    200,
  );

test('removing a source deletes only its owned selectors and persists the result', async () => {
  let state = subscribed();
  state = applyImportPlan(
    state,
    createImportPlan(state, [preset()], source('other')),
  );
  const local = preset('local-copy');
  state.items.push(local);
  const retained = state.items.slice(1);
  let stored: unknown = serializeLibraryBackup(state);
  const storage = {
    getItem: async () => stored,
    setItem: async (_key: string, value: unknown) => {
      stored = value;
      return value;
    },
  };
  await updateLibraryState(
    (current) => removeSelectorSource(current, 'source'),
    storage,
  );
  const result = await loadLibraryState(storage);
  assert.deepEqual(result.items, retained);
  assert.deepEqual(result.sources, [state.sources[1]]);
  assert.equal(removeSelectorSource(result, 'source'), result);
});

test('unchanged remote content returns the original state without a write', async () => {
  const state = subscribed();
  const { tags, ...rest } = preset();
  const remote = { tags, ...rest, updatedAt: 900, useCount: 99 };
  assert.equal(replaceSourceItems(state, state.sources[0], [remote]), state);
  let writes = 0;
  const storage = {
    getItem: async () => serializeLibraryBackup(state),
    setItem: async () => {
      writes += 1;
    },
  };
  await updateLibraryState(
    (current) => replaceSourceItems(current, state.sources[0], [remote]),
    storage,
  );
  assert.equal(writes, 0);
});
test('remote overwrites local edits and preserves personal preferences', () => {
  const state = subscribed();
  state.items[0] = {
    ...state.items[0],
    name: '本地修改',
    pinned: true,
    pinnedAt: 222,
    useCount: 9,
    lastUsedAt: 333,
  };
  const result = replaceSourceItems(
    state,
    state.sources[0],
    [preset('remote', '作者更新')],
    400,
  );
  assert.equal(result.items[0].name, '作者更新');
  assert.equal(result.items[0].pinned, true);
  assert.equal(result.items[0].pinnedAt, 222);
  assert.deepEqual(parseLibraryBackup(serializeLibraryBackup(result)), result);
  assert.equal(result.items[0].useCount, 9);
  assert.equal(result.items[0].lastUsedAt, 333);
  assert.equal(result.items[0].id, state.items[0].id);
  assert.deepEqual(Object.keys(result.sources[0].entries[0]).sort(), [
    'localId',
    'remoteId',
  ]);
  assert.equal(result.sources[0].checkedAt, 400);
});
test('whole-source replacement adds and removes entries without affecting other libraries', () => {
  const first = subscribed();
  const other = applyImportPlan(
    first,
    createImportPlan(first, [preset()], source('other')),
  );
  const state = {
    ...other,
    items: [...other.items, preset('local', '本地条目')],
  };
  const result = replaceSourceItems(state, state.sources[0], [
    preset('new', '新增'),
  ]);
  assert.equal(
    result.items.some((item) => item.id == first.items[0].id),
    false,
  );
  assert.equal(
    result.items.find((item) => item.id == 'local')?.name,
    '本地条目',
  );
  assert.equal(
    result.items.find((item) => item.id == other.items[1].id),
    other.items[1],
  );
  assert.deepEqual(
    result.sources[0].entries.map((entry) => entry.remoteId),
    ['new'],
  );
  const cleared = replaceSourceItems(result, result.sources[0], []);
  assert.equal(cleared.items.length, 2);
  assert.deepEqual(cleared.sources[0].entries, []);
  assert.equal(replaceSourceItems(cleared, cleared.sources[0], []), cleared);
});
test('updates restore previously deleted entries and follow remote order', () => {
  const state = subscribed();
  const missing = { ...state, items: [] };
  const restored = replaceSourceItems(missing, missing.sources[0], [preset()]);
  assert.equal(restored.items[0].id, state.items[0].id);
  const added = replaceSourceItems(restored, restored.sources[0], [
    preset(),
    preset('second'),
  ]);
  const reordered = replaceSourceItems(added, added.sources[0], [
    preset('second'),
    preset(),
  ]);
  assert.deepEqual(
    reordered.sources[0].entries.map((entry) => entry.remoteId),
    ['second', 'remote'],
  );
});
test('invalid data and changed sources fail atomically', async () => {
  const state = subscribed();
  const original = structuredClone(state);
  let writes = 0;
  const storage = {
    getItem: async () => serializeLibraryBackup(state),
    setItem: async () => {
      writes += 1;
    },
  };
  for (const value of [
    [preset(), {}],
    [preset(), preset()],
    { version: 2, items: [] },
  ]) {
    await assert.rejects(
      updateLibraryState(
        (current) => replaceSourceItems(current, state.sources[0], value),
        storage,
      ),
    );
  }
  assert.equal(writes, 0);
  assert.deepEqual(state, original);
  assert.throws(
    () => replaceSourceItems({ ...state, sources: [] }, state.sources[0], []),
    /来源已改变/,
  );
  assert.throws(
    () =>
      replaceSourceItems(
        {
          ...state,
          sources: [{ ...state.sources[0], url: 'https://example.com/new' }],
        },
        state.sources[0],
        [],
      ),
    /来源已改变/,
  );
});
test('sources are independent from local items and other sources with identical IDs', () => {
  const local = { items: [preset('local')], sources: [] };
  const state = applyImportPlan(
    local,
    createImportPlan(local, [preset()], source()),
  );
  assert.equal(state.items.length, 2);
  assert.equal(getSelectorSource(state.sources, 'local'), undefined);
  assert.equal(
    getSelectorSource(state.sources, state.items[1].id)?.id,
    'source',
  );
  const other = applyImportPlan(
    state,
    createImportPlan(state, [preset()], source('other')),
  );
  assert.equal(other.items.length, 3);
  assert.notEqual(other.items[1].id, other.items[2].id);
});
test('one-time imports preview replacement and ignore remote preferences', () => {
  const state = applyImportPlan(
    empty(),
    createImportPlan(empty(), [{ ...preset(), pinned: true, useCount: 42 }]),
  );
  assert.equal(state.items[0].useCount, 0);
  assert.equal(state.items[0].pinned, undefined);
  const plan = createImportPlan(state, [
    { ...preset(), name: '新版', selector: '[text="新版"]' },
  ]);
  assert.equal(plan.rows[0].status, 'updated');
  const result = applyImportPlan(state, plan);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, '新版');
  assert.throws(() => applyImportPlan({ ...state, items: [] }, plan), /已改变/);
});
test('legacy backups migrate without storing conflict baselines', async () => {
  const item = { ...preset(), pinned: true, useCount: 7, lastUsedAt: 123 };
  let value: unknown = serializeSelectorLibrary([item]);
  const storage = {
    getItem: async () => value,
    setItem: async (_key: string, next: unknown) => {
      value = next;
      return next;
    },
  };
  assert.deepEqual(await loadLibraryState(storage), {
    items: [item],
    sources: [],
  });
  const state = subscribed();
  const backup = serializeLibraryBackup(state);
  const sources = state.sources.map((item) => ({
    ...item,
    entries: item.entries.map((entry) => ({
      ...entry,
      baseline: preset(),
      removed: true,
    })),
  }));
  assert.deepEqual(parseLibraryBackup({ ...backup, sources }), state);
  assert.deepEqual(parseLibraryBackup(backup), state);
  await updateLibraryState(() => state, storage);
  assert.equal(JSON.stringify(value).includes('baseline'), false);
});
test('backup validates ownership and preferences cannot overwrite content', () => {
  const state = subscribed();
  const backup = serializeLibraryBackup(state);
  assert.throws(
    () =>
      parseLibraryBackup({
        ...backup,
        sources: [
          ...backup.sources,
          {
            ...backup.sources[0],
            id: 'other',
            url: 'https://example.com/other',
          },
        ],
      }),
    /重复/,
  );
  const parsed = parseLibraryBackup({
    ...backup,
    preferences: [{ id: state.items[0].id, name: 'injected', useCount: 2 }],
  });
  assert.equal(parsed.items[0].name, state.items[0].name);
  assert.equal(parsed.items[0].useCount, 2);
  const shared = serializeSharedLibrary([
    { ...preset(), pinned: true, useCount: 7, lastUsedAt: 123 },
  ]);
  for (const key of ['pinned', 'useCount', 'lastUsedAt'])
    assert.equal(key in shared.items[0], false);
});
test('invalid imports and duplicate source addresses are rejected', () => {
  assert.throws(() => createImportPlan(empty(), [preset(), preset()]), /重复/);
  assert.throws(() => createImportPlan(empty(), { items: [{}] }), /无效/);
  const state = subscribed();
  assert.throws(
    () =>
      createImportPlan(state, [], {
        ...source('another'),
        url: state.sources[0].url,
      }),
    /已存在/,
  );
  assert.throws(() => normalizeSourceUrl('file:///test.json'));
  assert.throws(() =>
    normalizeSourceUrl('https://user:pass@example.com/library'),
  );
  assert.equal(
    normalizeSourceUrl(' https://example.com/library#test '),
    'https://example.com/library',
  );
});
test('network import handles JSON, HTTP, invalid JSON, CORS and cancellation', async (t) => {
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ items: [] })),
  );
  assert.deepEqual(await fetchSelectorLibrary('https://example.com/library'), {
    items: [],
  });
  mock.mock.mockImplementation(async () => new Response('', { status: 404 }));
  await assert.rejects(
    fetchSelectorLibrary('https://example.com/library'),
    /HTTP 404/,
  );
  mock.mock.mockImplementation(async () => new Response('<html>'));
  await assert.rejects(
    fetchSelectorLibrary('https://example.com/library'),
    /JSON/,
  );
  mock.mock.mockImplementation(async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    fetchSelectorLibrary('https://example.com/library'),
    /跨域/,
  );
  const controller = new AbortController();
  controller.abort();
  mock.mock.mockImplementation(async (_input, init) => {
    init?.signal?.throwIfAborted();
    return new Response('{}');
  });
  await assert.rejects(
    fetchSelectorLibrary('https://example.com/library', controller.signal),
    { name: 'AbortError' },
  );
});
