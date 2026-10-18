<script setup lang="tsx">
import { NButton, NDataTable, NInput, NInputGroup, NTooltip } from 'naive-ui';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowReactive,
  shallowRef,
} from 'vue';
import { useRouter } from 'vue-router';

import type { Snapshot } from '@/entities/snapshot/types';

import GkSvg from '@/shared/ui/GkSvg.vue';
import { useLatestTask } from '@/shared/lib/latest_task';
import { useDeviceApi } from './api';
import { toValidURL } from '@/shared/lib/check';
import { message } from '@/shared/services/feedback';
import { errorWrap } from '@/shared/services/error';
import {
  screenshotStorage,
  snapshotStorage,
} from '@/entities/snapshot/storage';
import { useSnapshotColumns } from '@/entities/snapshot/ui/useSnapshotColumns';
import { useKeyedTask, useSingleTask } from '@/shared/lib/latest_task';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { RowKey, SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';
import SnapshotActionCard from '@/features/snapshot-management/ui/SnapshotActionCard.vue';
import SnapshotBatchActionsBar from '@/features/snapshot-management/ui/SnapshotBatchActionsBar.vue';
import { useBatchActions } from '@/features/snapshot-management/useBatchActions';
import DeviceActionDialogs from './DeviceActionDialogs.vue';
import PageBackButton from '@/features/navigation/PageBackButton.vue';

const router = useRouter();
const {
  api,
  origin,
  serverInfo,
  disconnect,
  prepareConnection,
  applyConnection,
} = useDeviceApi();
const link = shallowRef(localStorage.getItem(`device_link`) || ``);
const snapshots = shallowRef<Snapshot[]>([]);
const updateLink = (value: string) => {
  link.value = value;
};
const snapshotsTask = useLatestTask(async ({ commit }) => {
  const currentApi = api.value;
  const result = await currentApi.getSnapshots();
  if (currentApi !== api.value) return;
  commit(() => {
    snapshots.value = result.sort((a, b) => b.id - a.id);
  });
});
const loadSnapshots = async () => {
  await snapshotsTask.run();
};
const connectTask = useLatestTask(async ({ commit }) => {
  if (!link.value) return;
  const address = errorWrap(
    () => new URL(link.value.trim()),
    () => '非法设备地址',
  ).origin;
  const result = await prepareConnection(address);
  if (
    !commit(() => {
      snapshotsTask.cancel();
      applyConnection(result);
      link.value = address;
      snapshots.value = result.snapshots.sort((a, b) => b.id - a.id);
      checkedRowKeys.value = [];
      localStorage.setItem('device_link', address);
      document.title = serverTitle.value;
    })
  )
    result.controller.abort();
});

const serverTitle = computed(() => {
  if (!serverInfo.value) return '未连接设备';
  const d = serverInfo.value.device;
  const g = serverInfo.value.gkdAppInfo;
  return `${d.manufacturer} Android${d.release} - GKD${g.versionName}`;
});

onMounted(() => {
  if (toValidURL(link.value)) void connectTask.run();
});
onBeforeUnmount(() => {
  connectTask.cancel();
  snapshotsTask.cancel();
  disconnect();
});

const captureSnapshot = useSingleTask(async () => {
  const currentApi = api.value;
  const snapshot = await currentApi.captureSnapshot();
  const screenshot = await currentApi.getScreenshot({ id: snapshot.id });
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, screenshot);
  message.success(`捕获并保存快照成功`);
  if (currentApi === api.value) await loadSnapshots();
});
const downloadAllSnapshot = useSingleTask(async () => {
  const currentApi = api.value;
  const snapshotIds = (await currentApi.getSnapshots()).map((s) => s.id);
  const existSnapshotIds = new Set(
    (await screenshotStorage.keys()).map((s) => parseInt(s)),
  );
  const unimportSnapshotIds = snapshotIds.filter(
    (k) => !existSnapshotIds.has(k),
  );
  if (unimportSnapshotIds.length == 0) {
    message.success(`没有新记录可导入`);
    return;
  }
  let r = 0;
  const limit = pLimit(3);
  await Promise.all(
    unimportSnapshotIds.map((snapshotId) =>
      limit(async () => {
        const [newSnapshot, newScreenshot] = await Promise.all([
          currentApi.getSnapshot({ id: snapshotId }),
          currentApi.getScreenshot({ id: snapshotId }),
        ] as const);
        if (!newSnapshot.nodes) return;
        await Promise.all([
          snapshotStorage.setItem(snapshotId, newSnapshot),
          screenshotStorage.setItem(snapshotId, newScreenshot),
        ]);
        r++;
      }),
    ),
  );
  message.success(`导入${r}条新记录`);
});

const {
  activityIdCol,
  appIdCol,
  appNameCol,
  ctimeCol,
  appVersionCodeCol,
  appVersionNameCol,
  resetColWidth,
} = useSnapshotColumns();
const handleSorterChange = (sorter: SortState) => {
  if (sorter.columnKey == ctimeCol.key) {
    ctimeCol.sortOrder = sorter.order;
  }
};
const previewSnapshot = useKeyedTask(async (_context, snapshotId: number) => {
  const currentApi = api.value;
  if (!(await snapshotStorage.hasItem(snapshotId))) {
    const obj = await currentApi.getSnapshot({ id: snapshotId });
    await snapshotStorage.setItem(snapshotId, obj);
  }
  if (!(await screenshotStorage.hasItem(snapshotId))) {
    const bf = await currentApi.getScreenshot({ id: snapshotId });
    await screenshotStorage.setItem(snapshotId, bf);
  }
  window.open(
    router.resolve({
      name: 'snapshot',
      params: { snapshotId: snapshotId },
    }).href,
  );
});

const columns: DataTableColumns<Snapshot> = [
  {
    type: 'selection',
  },
  ctimeCol,
  appNameCol,
  appIdCol,
  appVersionCodeCol,
  appVersionNameCol,
  activityIdCol,
  {
    key: `actions`,
    title: `操作`,
    fixed: 'right',
    width: `160px`,
    render(row) {
      return (
        <SnapshotActionCard
          snapshot={row}
          showExport={false}
          showShare={false}
          deleteConfirmText={`是否确认删除? 此操作不可恢复!\n快照ID:${row.id}`}
          onPreview={() => previewSnapshot.run(row.id)}
          previewLoading={previewSnapshot.loading.value[row.id]}
          onBeforeDelete={async () =>
            await api.value.deleteSnapshot({ id: row.id })
          }
          onDelete={() => {
            snapshots.value = snapshots.value.filter((s) => s.id !== row.id);
          }}
        />
      );
    },
  },
];

const checkedRowKeys = ref<number[]>([]);
const { batchDelete } = useBatchActions(checkedRowKeys, () => {
  const currentApi = api.value;
  return {
    isCurrent: () => currentApi === api.value,
    beforeDeleteItem: (id) => currentApi.deleteSnapshot({ id }),
    prepareAfterDelete: async () => {
      const result = await currentApi.getSnapshots();
      return () => {
        snapshotsTask.cancel();
        snapshots.value = result.sort((a, b) => b.id - a.id);
      };
    },
  };
});

const pagination = shallowReactive<PaginationProps>({
  page: 1,
  pageSize: 50,
  showSizePicker: true,
  pageSizes: [50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    resetColWidth();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    resetColWidth();
  },
});

const showSubsModel = shallowRef(false);
const showSelectorModel = shallowRef(false);
const setSubscriptionDialogVisible = (show: boolean) => {
  showSubsModel.value = show;
};
const setSelectorDialogVisible = (show: boolean) => {
  showSelectorModel.value = show;
};
const updateCheckedRowKeys = (keys: RowKey[]) => {
  checkedRowKeys.value = keys.filter(
    (key): key is number => typeof key == 'number',
  );
};
const stopConnection = () => {
  connectTask.cancel();
  snapshotsTask.cancel();
  disconnect();
  snapshots.value = [];
  checkedRowKeys.value = [];
  setSubscriptionDialogVisible(false);
  setSelectorDialogVisible(false);
  document.title = '连接设备';
};
</script>
<template>
  <DeviceActionDialogs
    :key="origin?.toString()"
    :api="api"
    :subscriptionShow="showSubsModel"
    :selectorShow="showSelectorModel"
    @update:subscriptionShow="setSubscriptionDialogVisible"
    @update:selectorShow="setSelectorDialogVisible"
  />
  <div class="w-(--gkd-w) h-(--gkd-h) flex flex-col p-[10px] gap-[10px]">
    <div class="flex items-center gap-[24px]">
      <PageBackButton class="ml-[12px]" />
      <NInputGroup>
        <NInput
          :value="link"
          placeholder="请输入设备地址"
          class="font-mono!"
          :style="{ width: `240px` }"
          @keyup.enter="connectTask.run"
          @update:value="updateLink"
        >
          <template #suffix>
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  style="--n-icon-size: 20px"
                  :loading="connectTask.loading.value"
                  @click="connectTask.run"
                >
                  <template #icon><GkSvg name="refresh" /></template>
                </NButton>
              </template>
              刷新连接
            </NTooltip>
          </template>
        </NInput>
        <NButton
          v-if="connectTask.loading.value"
          secondary
          type="error"
          @click="stopConnection"
        >
          停止
        </NButton>

        <div
          v-if="serverInfo"
          class="font-mono! pl-[16px] whitespace-nowrap flex items-center"
        >
          {{ serverTitle }}
        </div>
      </NInputGroup>
      <template v-if="serverInfo">
        <SnapshotBatchActionsBar
          :checkedCount="checkedRowKeys.length"
          :batchDelete="batchDelete"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="captureSnapshot.loading.value"
              @click="captureSnapshot.run"
            >
              <template #icon><GkSvg name="Snapshot" /></template>
            </NButton>
          </template>
          捕获快照
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="downloadAllSnapshot.loading.value"
              @click="downloadAllSnapshot.run"
            >
              <template #icon><GkSvg name="Down-all" /></template>
            </NButton>
          </template>
          下载所有快照
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              @click="setSubscriptionDialogVisible(true)"
            >
              <template #icon><GkSvg name="CacheSub" /></template>
            </NButton>
          </template>
          修改内存订阅
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              @click="setSelectorDialogVisible(true)"
            >
              <template #icon><GkSvg name="Exe-Sel" /></template>
            </NButton>
          </template>
          执行选择器
        </NTooltip>
      </template>
    </div>
    <NDataTable
      :checkedRowKeys="checkedRowKeys"
      striped
      flex-height
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      :rowKey="(r:Snapshot)=>r.id"
      size="small"
      class="flex-1"
      :scrollX="1200"
      @update:checkedRowKeys="updateCheckedRowKeys"
      @update:sorter="handleSorterChange"
    />
  </div>
</template>
