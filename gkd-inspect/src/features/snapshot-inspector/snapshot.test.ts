import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { effectScope, reactive } from 'vue';
import type { Snapshot } from '@/entities/snapshot/types';

const mocks = vi.hoisted(() => ({
  route: {
    path: '/snapshot/1',
    params: { snapshotId: '1' } as Record<string, string>,
    query: {},
  },
  getSnapshot: vi.fn(),
  getScreenshot: vi.fn(),
  readRemote: vi.fn(),
  decode: vi.fn(),
  replace: vi.fn(),
  importIds: {} as Record<string, number>,
  snapshotIds: {} as Record<string, number>,
}));
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/entities/snapshot/storage', () => ({
  snapshotStorage: { getItem: mocks.getSnapshot, setItem: vi.fn() },
  screenshotStorage: { getItem: mocks.getScreenshot, setItem: vi.fn() },
}));
vi.mock('@/entities/snapshot/metadataStore', () => ({
  snapshotImportId: mocks.importIds,
  importSnapshotId: mocks.snapshotIds,
  snapshotImageId: {},
  snapshotMetadataActions: {
    setViewedTime: vi.fn(),
    setImageId: vi.fn(),
    setImportTime: vi.fn(),
    setSnapshotId: (id: number, value: number) => {
      mocks.snapshotIds[id] = value;
    },
    setImportId: (id: number, value: number) => {
      mocks.importIds[id] = value;
    },
  },
}));
vi.mock('@/features/settings/store', () => ({
  settingsStore: { maxShowNodeSize: 100, autoUploadImport: false },
}));
vi.mock('@/shared/api/gm', () => ({ gmOk: () => false }));
vi.mock('@/entities/snapshot/api', () => ({
  getSnapshotImportId: async () => null,
}));
vi.mock('@/entities/snapshot/urls', () => ({
  getImportFileUrl: (id: number) => String(id),
}));
vi.mock('@/features/snapshot-management/import', () => ({
  readSnapshotFromNetwork: mocks.readRemote,
}));
vi.mock('@/features/snapshot-management/export', () => ({
  detectSnapshot: vi.fn(),
  exportSnapshotAsImageId: vi.fn(),
  exportSnapshotAsImportId: vi.fn(),
}));
vi.mock('@/entities/snapshot/node', () => ({
  getAppInfo: () => ({ name: 'test' }),
  listToTree: (nodes: Snapshot['nodes']) => nodes[0],
  findNodesByXy: () => [],
}));

import { useSnapshotStore } from './snapshot';
import { encodeSnapshotUrlStateParam } from './snapshot_url_codec';

const makeSnapshot = (id: number) =>
  ({
    id,
    nodes: [
      {
        id: 0,
        pid: -1,
        children: [],
        attr: { name: 'View', text: String(id) },
      },
    ],
  }) as unknown as Snapshot;
const navigate = (id: number) => {
  mocks.route.path = `/snapshot/${id}`;
  mocks.route.params = { snapshotId: String(id) };
  return { ...mocks.route };
};
let scope: ReturnType<typeof effectScope>;
beforeEach(() => {
  mocks.route = reactive({
    path: '/snapshot/1',
    params: { snapshotId: '1' },
    query: {},
  });
  Object.keys(mocks.importIds).forEach((key) => delete mocks.importIds[key]);
  Object.keys(mocks.snapshotIds).forEach(
    (key) => delete mocks.snapshotIds[key],
  );
  mocks.getSnapshot.mockImplementation(async (id: number) => makeSnapshot(id));
  mocks.getScreenshot.mockImplementation(
    async (id: number) => new Uint8Array([id]).buffer,
  );
  mocks.decode.mockResolvedValue(undefined);
  mocks.readRemote.mockResolvedValue(undefined);
  vi.stubGlobal('document', { title: '' });
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        return mocks.decode(this.src);
      }
    },
  );
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    () => `blob:${Math.random()}`,
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  scope = effectScope();
});
afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

test('retains the whole previous snapshot until the next image is decoded', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const previous = {
    snapshot: store.snapshot.value,
    url: store.screenshotUrl.value,
    focus: store.focusNode.value,
  };
  const decoding = Promise.withResolvers<void>();
  mocks.decode.mockReturnValueOnce(decoding.promise);
  const pending = store.loadFromRoute(navigate(2));
  await vi.waitFor(() => assert.equal(mocks.decode.mock.calls.length, 2));
  assert.equal(store.loading.value, true);
  assert.equal(store.snapshot.value, previous.snapshot);
  assert.equal(store.screenshotUrl.value, previous.url);
  assert.equal(store.focusNode.value, previous.focus);
  decoding.resolve();
  assert.equal((await pending).status, 'success');
  assert.equal(store.snapshot.value?.id, 2);
  assert.notEqual(store.screenshotUrl.value, previous.url);
  assert.equal(store.focusNode.value?.attr.text, '2');
  assert.equal(store.loading.value, false);
  assert.ok(
    vi
      .mocked(URL.revokeObjectURL)
      .mock.calls.some(([url]) => url === previous.url),
  );
});

test('late loads cannot replace a newer snapshot or its execution status', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const delayed = Promise.withResolvers<Snapshot>();
  mocks.getSnapshot.mockImplementation(async (id: number) =>
    id === 2 ? delayed.promise : makeSnapshot(id),
  );
  const oldLoad = store.loadFromRoute(navigate(2));
  await vi.waitFor(() =>
    assert.ok(mocks.getSnapshot.mock.calls.some(([id]) => id === 2)),
  );
  await store.loadFromRoute(navigate(3));
  delayed.resolve(makeSnapshot(2));
  assert.equal((await oldLoad).status, 'stale');
  assert.equal(store.snapshot.value?.id, 3);
  assert.equal(store.focusNode.value?.attr.text, '3');
  assert.equal(store.loading.value, false);
  assert.equal(store.error.value, undefined);
});

test('decode failures retain the previous frame and expose the task error', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const url = store.screenshotUrl.value;
  mocks.decode.mockRejectedValueOnce(new Error('decode failed'));
  assert.equal((await store.loadFromRoute(navigate(2))).status, 'error');
  assert.equal(store.snapshot.value?.id, 1);
  assert.equal(store.screenshotUrl.value, url);
  assert.equal(store.error.value?.message, 'decode failed');
  assert.equal(store.loading.value, false);
  await store.loadFromRoute(navigate(2));
  assert.equal(store.snapshot.value?.id, 2);
  assert.equal(store.error.value, undefined);
});

test('query changes refresh search without reloading the image', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const revision = store.searchRevision.value;
  const url = store.screenshotUrl.value;
  const reads = mocks.getScreenshot.mock.calls.length;
  const state = await encodeSnapshotUrlStateParam({
    queries: [{ type: 'text', value: 'hello' }],
  });
  mocks.route.query = { state };
  const result = await store.loadFromRoute({ ...mocks.route });
  assert.equal(result.status, 'success');
  if (result.status === 'success') assert.equal(result.value, undefined);
  assert.equal(store.screenshotUrl.value, url);
  assert.equal(mocks.getScreenshot.mock.calls.length, reads);
  assert.equal(store.searchRevision.value, revision + 1);
});

test('canonical shared links reuse the loaded frame', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const snapshot = store.snapshot.value;
  const url = store.screenshotUrl.value;
  mocks.snapshotIds[10] = 1;
  mocks.route.path = '/i/10';
  mocks.route.params = { github_asset_id: '10' };
  await store.loadFromRoute({ ...mocks.route });
  assert.equal(store.snapshot.value, snapshot);
  assert.equal(store.screenshotUrl.value, url);
  assert.equal(store.importId.value, 10);
});

test('cancelling navigation prevents late image decoding from committing', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  const previous = store.screenshotUrl.value;
  const decoding = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  mocks.decode.mockImplementationOnce(() => {
    started.resolve();
    return decoding.promise;
  });
  const load = store.loadFromRoute(navigate(2));
  await started.promise;
  store.cancelLoad();
  decoding.resolve();
  assert.equal((await load).status, 'stale');
  assert.equal(store.snapshot.value?.id, 1);
  assert.equal(store.screenshotUrl.value, previous);
  assert.equal(store.loading.value, false);
});

test('remote import metadata is committed together with the decoded frame', async () => {
  const store = scope.run(() => useSnapshotStore())!;
  await store.loadFromRoute(navigate(1));
  mocks.readRemote.mockResolvedValueOnce({
    snapshot: makeSnapshot(2),
    screenshotBf: new Uint8Array([2]).buffer,
  });
  const decoding = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  mocks.decode.mockImplementationOnce(() => {
    started.resolve();
    return decoding.promise;
  });
  mocks.route.path = '/i/20';
  mocks.route.params = { github_asset_id: '20' };
  const load = store.loadFromRoute({ ...mocks.route });
  await started.promise;
  assert.equal(store.snapshot.value?.id, 1);
  assert.equal(mocks.snapshotIds[20], undefined);
  assert.equal(mocks.importIds[2], undefined);
  decoding.resolve();
  await load;
  assert.equal(store.snapshot.value?.id, 2);
  assert.equal(mocks.snapshotIds[20], 2);
  assert.equal(mocks.importIds[2], 20);
});
