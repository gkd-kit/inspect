import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  onBeforeUnmount: vi.fn(),
}));
import { useSnapshotPreviewCache } from './useSnapshotPreviewCache';

test('preview requests are deduplicated per ID and cleared requests cannot repopulate the cache', async () => {
  const a = Promise.withResolvers<ArrayBuffer | null>();
  const b = Promise.withResolvers<ArrayBuffer | null>();
  const getScreenshot = vi.fn((id: number) =>
    id === 1 ? a.promise : b.promise,
  );
  const createUrl = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:test');
  const revokeUrl = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => {});
  const cache = useSnapshotPreviewCache({ getScreenshot });
  const first = cache.loadPreview(1),
    duplicate = cache.loadPreview(1),
    other = cache.loadPreview(2);
  assert.equal(getScreenshot.mock.calls.length, 2);
  cache.clearPreview(1);
  assert.equal(cache.loading[1], undefined);
  assert.equal(cache.loading[2], true);
  a.resolve(new ArrayBuffer(1));
  b.resolve(new ArrayBuffer(2));
  await Promise.all([first, duplicate, other]);
  assert.equal(createUrl.mock.calls.length, 1);
  assert.equal(cache.urls[1], undefined);
  assert.equal(cache.urls[2], 'blob:test');
  cache.dispose();
  assert.deepEqual(revokeUrl.mock.calls, [['blob:test']]);
});

test('preview errors stay with their ID, retries reset them, and eviction releases URLs', async () => {
  let index = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:' + ++index);
  const revokeUrl = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => {});
  const getScreenshot = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValue(new ArrayBuffer(1));
  const cache = useSnapshotPreviewCache({ getScreenshot, maxEntries: 1 });
  await cache.loadPreview(1);
  assert.equal(cache.errors[1], '暂无预览图');
  await cache.loadPreview(2);
  assert.equal(cache.errors[2], undefined);
  await cache.loadPreview(1);
  assert.equal(cache.errors[1], undefined);
  assert.equal(cache.urls[2], undefined);
  assert.deepEqual(revokeUrl.mock.calls, [['blob:1']]);
  cache.dispose();
});
