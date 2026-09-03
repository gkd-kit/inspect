import { onBeforeUnmount, shallowReactive, shallowReadonly } from 'vue';

interface SnapshotPreviewCacheOptions {
  getScreenshot: (snapshotId: number) => Promise<ArrayBuffer | null>;
  maxEntries?: number;
}

export const useSnapshotPreviewCache = (
  options: SnapshotPreviewCacheOptions,
) => {
  const maxEntries = Math.max(1, options.maxEntries ?? 12);
  const urlData = shallowReactive<Record<number, string>>({});
  const loadingData = shallowReactive<Record<number, boolean>>({});
  const errorData = shallowReactive<Record<number, string>>({});
  const revisions = new Map<number, number>();
  const order: number[] = [];
  let disposed = false;

  const removeOrderEntry = (snapshotId: number) => {
    const index = order.indexOf(snapshotId);
    if (index >= 0) order.splice(index, 1);
  };

  const clearPreview = (snapshotId: number) => {
    revisions.set(snapshotId, (revisions.get(snapshotId) ?? 0) + 1);
    const url = urlData[snapshotId];
    if (url) URL.revokeObjectURL(url);
    delete urlData[snapshotId];
    delete loadingData[snapshotId];
    delete errorData[snapshotId];
    removeOrderEntry(snapshotId);
  };

  const touch = (snapshotId: number) => {
    removeOrderEntry(snapshotId);
    order.push(snapshotId);
    while (order.length > maxEntries) {
      const oldestId = order[0];
      if (oldestId === undefined) break;
      clearPreview(oldestId);
    }
  };

  const loadPreview = async (snapshotId: number) => {
    if (disposed) return;
    if (urlData[snapshotId]) {
      touch(snapshotId);
      return;
    }
    if (loadingData[snapshotId]) return;

    const revision = (revisions.get(snapshotId) ?? 0) + 1;
    revisions.set(snapshotId, revision);
    loadingData[snapshotId] = true;
    delete errorData[snapshotId];
    try {
      const screenshot = await options.getScreenshot(snapshotId);
      if (disposed || revisions.get(snapshotId) !== revision) return;
      if (!screenshot) {
        errorData[snapshotId] = '暂无预览图';
        return;
      }
      const url = URL.createObjectURL(new Blob([screenshot]));
      if (disposed || revisions.get(snapshotId) !== revision) {
        URL.revokeObjectURL(url);
        return;
      }
      urlData[snapshotId] = url;
      touch(snapshotId);
    } catch {
      if (!disposed && revisions.get(snapshotId) === revision) {
        errorData[snapshotId] = '预览加载失败';
      }
    } finally {
      if (!disposed && revisions.get(snapshotId) === revision) {
        delete loadingData[snapshotId];
      }
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [...order].forEach(clearPreview);
    revisions.clear();
  };
  onBeforeUnmount(dispose);

  return {
    urls: shallowReadonly(urlData),
    loading: shallowReadonly(loadingData),
    errors: shallowReadonly(errorData),
    loadPreview,
    clearPreview,
    dispose,
  };
};
