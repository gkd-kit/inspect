import {
  computed,
  onBeforeUnmount,
  shallowReactive,
  shallowReadonly,
} from 'vue';
import { useKeyedTask } from '@/shared/lib/latest_task';

interface SnapshotPreviewCacheOptions {
  getScreenshot: (snapshotId: number) => Promise<ArrayBuffer | null>;
  maxEntries?: number;
}

export const useSnapshotPreviewCache = (
  options: SnapshotPreviewCacheOptions,
) => {
  const maxEntries = Math.max(1, options.maxEntries ?? 12);
  const urlData = shallowReactive<Record<number, string>>({});
  const order: number[] = [];
  let disposed = false;

  const removeOrderEntry = (snapshotId: number) => {
    const index = order.indexOf(snapshotId);
    if (index >= 0) order.splice(index, 1);
  };

  const clearPreview = (snapshotId: number) => {
    previewTask.cancel(snapshotId);
    const url = urlData[snapshotId];
    if (url) URL.revokeObjectURL(url);
    delete urlData[snapshotId];
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

  const previewTask = useKeyedTask(
    async ({ commit, isCurrent }, snapshotId: number) => {
      let screenshot: ArrayBuffer | null;
      try {
        screenshot = await options.getScreenshot(snapshotId);
      } catch {
        throw new Error('预览加载失败');
      }
      if (!isCurrent()) return;
      if (!screenshot) throw new Error('暂无预览图');
      commit(() => {
        urlData[snapshotId] = URL.createObjectURL(new Blob([screenshot]));
        touch(snapshotId);
      });
    },
  );
  const loadPreview = async (snapshotId: number) => {
    if (disposed) return;
    if (urlData[snapshotId]) {
      touch(snapshotId);
      return;
    }
    await previewTask.run(snapshotId);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [...order].forEach(clearPreview);
    previewTask.cancelAll();
  };
  onBeforeUnmount(dispose);
  const errors = computed(() =>
    Object.fromEntries(
      Object.entries(previewTask.errors.value).map(([key, error]) => [
        key,
        error?.message,
      ]),
    ),
  );

  return {
    urls: shallowReadonly(urlData),
    get loading() {
      return previewTask.loading.value;
    },
    get errors() {
      return errors.value;
    },
    loadPreview,
    clearPreview,
    dispose,
  };
};
