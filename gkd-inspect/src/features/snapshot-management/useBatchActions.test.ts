import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import { ref } from 'vue';
const mocks = vi.hoisted(() => ({
  confirm: undefined as undefined | (() => void),
  remove: vi.fn(),
}));
vi.mock('@/shared/services/feedback', () => ({
  dialog: {
    error: (options: { onPositiveClick: () => void }) => {
      mocks.confirm = options.onPositiveClick;
    },
  },
  message: { success: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/features/snapshot-management/dialog', () => ({
  showTextDLg: vi.fn(),
  waitShareAgree: vi.fn(),
}));
vi.mock('@/features/snapshot-management/export', () => ({
  batchCreateImageId: vi.fn(),
  batchCreateZipUrl: vi.fn(),
  batchImageDownloadZip: vi.fn(),
  batchZipDownloadZip: vi.fn(),
}));
vi.mock('@/entities/snapshot/storage', () => ({
  snapshotStorage: { removeItem: mocks.remove },
}));
import { useBatchActions } from './useBatchActions';
beforeEach(() => {
  mocks.confirm = undefined;
  mocks.remove.mockReset().mockResolvedValue(undefined);
});

test('batch deletion fixes the confirmed IDs and commits the refreshed list with failed selections', async () => {
  const selected = ref([1, 2]);
  const removed: number[] = [];
  let applied = false;
  const actions = useBatchActions(selected, {
    beforeDeleteItem: async (id) => {
      removed.push(id);
      if (id === 2) throw new Error('failed');
    },
    prepareAfterDelete: async () => () => {
      applied = true;
    },
  });
  const run = actions.batchDelete.run();
  const duplicate = actions.batchDelete.run();
  assert.equal(actions.batchDelete.loading.value, true);
  selected.value = [3];
  mocks.confirm!();
  await Promise.all([run, duplicate]);
  assert.deepEqual(removed, [1, 2]);
  assert.deepEqual(mocks.remove.mock.calls, [[1]]);
  assert.equal(applied, true);
  assert.deepEqual(selected.value, [2]);
});

test('changing device during confirmation does not delete on the replacement device', async () => {
  let session = 1;
  const selected = ref([10]);
  const remove = vi.fn();
  const actions = useBatchActions(selected, () => {
    const initialSession = session;
    return {
      isCurrent: () => session === initialSession,
      beforeDeleteItem: remove,
    };
  });
  const run = actions.batchDelete.run();
  session = 2;
  selected.value = [20];
  mocks.confirm!();
  await run;
  assert.equal(remove.mock.calls.length, 0);
  assert.equal(mocks.remove.mock.calls.length, 0);
  assert.deepEqual(selected.value, [20]);
});
