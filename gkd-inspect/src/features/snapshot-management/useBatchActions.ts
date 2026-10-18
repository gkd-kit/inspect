import { type Ref } from 'vue';
import type { Snapshot } from '@/entities/snapshot/types';
import {
  showTextDLg,
  waitShareAgree,
} from '@/features/snapshot-management/dialog';
import { dialog, message } from '@/shared/services/feedback';
import {
  batchCreateImageId,
  batchCreateZipUrl,
  batchImageDownloadZip,
  batchZipDownloadZip,
} from '@/features/snapshot-management/export';
import { DELETE_TIMEOUT, withTimeout } from '@/shared/lib/async';
import { snapshotStorage } from '@/entities/snapshot/storage';
import { useSingleTask } from '@/shared/lib/latest_task';
import { getImagUrl, getImportUrl } from '@/entities/snapshot/urls';

interface BatchActionOptions {
  prepareAfterDelete?: () => Promise<() => void>;
  beforeDeleteItem?: (id: number) => Promise<unknown>;
  isCurrent?: () => boolean;
}

export const useBatchActions = (
  checkedRowKeys: Ref<number[]>,
  options: BatchActionOptions | (() => BatchActionOptions) = {},
) => {
  // Devicepage暂不支持批量操作
  const checkedSnapshots = () => {
    return Promise.all(
      checkedRowKeys.value.map(
        (id) => snapshotStorage.getItem(id) as Promise<Snapshot>,
      ),
    );
  };

  const batchDelete = useSingleTask(async ({ commit }) => {
    const currentOptions = typeof options === 'function' ? options() : options;
    const ids = [...checkedRowKeys.value];
    let failedIds: number[];
    await new Promise((res, rej) => {
      dialog.error({
        title: `删除`,
        content: `是否批量删除 ${ids.length} 个快照`,
        negativeText: `取消`,
        positiveText: `确认`,
        onClose: rej,
        onEsc: rej,
        onMaskClick: rej,
        onNegativeClick: rej,
        onPositiveClick: res,
      });
    });
    if (currentOptions.isCurrent && !currentOptions.isCurrent()) return;
    if (currentOptions.beforeDeleteItem) {
      const remoteResults = await Promise.allSettled(
        ids.map((k) => currentOptions.beforeDeleteItem!(k)),
      );
      const remoteFailedIds = ids.filter(
        (_, i) => remoteResults[i].status === 'rejected',
      );
      const remoteSuccessIds = ids.filter(
        (_, i) => remoteResults[i].status === 'fulfilled',
      );
      const localResults = await Promise.allSettled(
        remoteSuccessIds.map((k) =>
          withTimeout(
            () => snapshotStorage.removeItem(k),
            DELETE_TIMEOUT,
            `本地删除超时`,
          ),
        ),
      );
      const localFailedIds = remoteSuccessIds.filter(
        (_, i) => localResults[i].status === 'rejected',
      );
      const localSuccessIds = remoteSuccessIds.filter(
        (_, i) => localResults[i].status === 'fulfilled',
      );
      const allFailedIds = [...remoteFailedIds, ...localFailedIds];
      const successCount = localSuccessIds.length;
      const remoteFailCount = remoteFailedIds.length;
      const localFailCount = localFailedIds.length;
      if (successCount) {
        message.success(`删除成功 ${successCount} 个`);
      }
      if (remoteFailCount || localFailCount) {
        message.warning(
          `远程删除失败 ${remoteFailCount} 个，本地删除失败 ${localFailCount} 个`,
        );
      }
      failedIds = allFailedIds;
    } else {
      const localResults = await Promise.allSettled(
        ids.map((k) =>
          withTimeout(
            () => snapshotStorage.removeItem(k),
            DELETE_TIMEOUT,
            `本地删除超时`,
          ),
        ),
      );
      const localFailedIds = ids.filter(
        (_, i) => localResults[i].status === 'rejected',
      );
      const localSuccessIds = ids.filter(
        (_, i) => localResults[i].status === 'fulfilled',
      );
      if (localFailedIds.length) {
        message.warning(
          `删除成功 ${localSuccessIds.length} 个，失败 ${localFailedIds.length} 个`,
        );
      } else {
        message.success(`删除成功 ${localSuccessIds.length} 个`);
      }
      failedIds = localFailedIds;
    }
    const apply = await currentOptions.prepareAfterDelete?.();
    if (currentOptions.isCurrent && !currentOptions.isCurrent()) return;
    commit(() => {
      apply?.();
      checkedRowKeys.value = failedIds;
    });
  });

  const batchDownloadImage = useSingleTask(async () => {
    await batchImageDownloadZip(await checkedSnapshots());
  });

  const batchDownloadZip = useSingleTask(async () => {
    await batchZipDownloadZip(await checkedSnapshots());
  });

  const batchShareImageUrl = useSingleTask(async () => {
    await waitShareAgree();
    const imageIds = await batchCreateImageId(await checkedSnapshots());
    showTextDLg({
      content: imageIds.map((s) => getImagUrl(s)).join(`\n`) + `\n`,
    });
  });

  const batchShareZipUrl = useSingleTask(async () => {
    await waitShareAgree();
    const zipUrls = await batchCreateZipUrl(await checkedSnapshots());
    showTextDLg({
      content: zipUrls.map((s) => getImportUrl(s)).join(`\n`) + `\n`,
    });
  });

  return {
    batchDelete,
    batchDownloadImage,
    batchDownloadZip,
    batchShareImageUrl,
    batchShareZipUrl,
  };
};
