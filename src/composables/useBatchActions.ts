import { showTextDLg, waitShareAgree } from '@/domain/snapshot/dialog';
import { dialog, message } from '@/utils/discrete';
import {
  batchCreateImageId,
  batchCreateZipUrl,
  batchImageDownloadZip,
  batchZipDownloadZip,
} from '@/domain/snapshot/export';
import { withTimeout, DELETE_TIMEOUT } from '@/utils/others';
import { snapshotStorage } from '@/domain/snapshot/storage';
import { useTask } from '@/utils/task';
import { getImagUrl, getImportUrl } from '@/utils/url';

export const useBatchActions = (
  checkedRowKeys: Ref<number[]>,
  options: {
    onAfterDelete?: () => void | Promise<void>;
    beforeDeleteItem?: (id: number) => Promise<unknown>;
  } = {},
) => {
  // Devicepage暂不支持批量操作
  const checkedSnapshots = () => {
    return Promise.all(
      checkedRowKeys.value.map(
        (id) => snapshotStorage.getItem(id) as Promise<Snapshot>,
      ),
    );
  };

  const batchDelete = useTask(async () => {
    await new Promise((res, rej) => {
      dialog.error({
        title: `删除`,
        content: `是否批量删除 ${checkedRowKeys.value.length} 个快照`,
        negativeText: `取消`,
        positiveText: `确认`,
        onClose: rej,
        onEsc: rej,
        onMaskClick: rej,
        onNegativeClick: rej,
        onPositiveClick: res,
      });
    });
    if (options.beforeDeleteItem) {
      const remoteResults = await Promise.allSettled(
        checkedRowKeys.value.map((k) => options.beforeDeleteItem!(k)),
      );
      const remoteFailedIds = checkedRowKeys.value.filter(
        (_, i) => remoteResults[i].status === 'rejected',
      );
      const remoteSuccessIds = checkedRowKeys.value.filter(
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
      checkedRowKeys.value = allFailedIds;
    } else {
      const localResults = await Promise.allSettled(
        checkedRowKeys.value.map((k) =>
          withTimeout(
            () => snapshotStorage.removeItem(k),
            DELETE_TIMEOUT,
            `本地删除超时`,
          ),
        ),
      );
      const localFailedIds = checkedRowKeys.value.filter(
        (_, i) => localResults[i].status === 'rejected',
      );
      const localSuccessIds = checkedRowKeys.value.filter(
        (_, i) => localResults[i].status === 'fulfilled',
      );
      if (localFailedIds.length) {
        message.warning(
          `删除成功 ${localSuccessIds.length} 个，失败 ${localFailedIds.length} 个`,
        );
      } else {
        message.success(`删除成功 ${localSuccessIds.length} 个`);
      }
      checkedRowKeys.value = localFailedIds;
    }
    await options.onAfterDelete?.();
  });

  const batchDownloadImage = useTask(async () => {
    await batchImageDownloadZip(await checkedSnapshots());
  });

  const batchDownloadZip = useTask(async () => {
    await batchZipDownloadZip(await checkedSnapshots());
  });

  const batchShareImageUrl = useTask(async () => {
    await waitShareAgree();
    const imageIds = await batchCreateImageId(await checkedSnapshots());
    showTextDLg({
      content: imageIds.map((s) => getImagUrl(s)).join(`\n`) + `\n`,
    });
  });

  const batchShareZipUrl = useTask(async () => {
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
