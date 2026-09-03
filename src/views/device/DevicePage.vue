<script setup lang="tsx">
import { useDeviceApi } from './api';
import { toValidURL } from '@/utils/check';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { delay } from '@/utils/others';
import { screenshotStorage, snapshotStorage } from '@/domain/snapshot/storage';
import { useSnapshotColumns } from '@/domain/snapshot/table';
import { useBatchTask, useTask } from '@/utils/task';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { RowKey, SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';
import ActionCard from '@/components/snapshot/ActionCard.vue';
import BatchActionsBar from '@/components/snapshot/BatchActionsBar.vue';
import { useBatchActions } from '@/composables/useBatchActions';
import DeviceActionDialogs from './DeviceActionDialogs.vue';

const router = useRouter();
const { api, origin, serverInfo, disconnect } = useDeviceApi();
const link = shallowRef(localStorage.getItem(`device_link`) || ``);
const snapshots = shallowRef<Snapshot[]>([]);
let connectionVersion = 0;
const updateLink = (value: string) => {
  link.value = value;
};
const loadSnapshots = async (version = connectionVersion) => {
  const result = await api.getSnapshots();
  if (version != connectionVersion) return;
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
};
const connect = useTask(async () => {
  if (!link.value) return;
  const version = ++connectionVersion;
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  localStorage.setItem(`device_link`, link.value);
  const result = await api.getServerInfo();
  if (version != connectionVersion) return;
  serverInfo.value = result;
  document.title = serverTitle.value;
  await loadSnapshots(version);
});

const serverTitle = computed(() => {
  if (!serverInfo.value) return '未连接设备';
  const d = serverInfo.value.device;
  const g = serverInfo.value.gkdAppInfo;
  return `${d.manufacturer} Android${d.release} - GKD${g.versionName}`;
});

onMounted(async () => {
  await delay(500);
  if (toValidURL(link.value)) {
    connect.invoke();
  }
});

const captureSnapshot = useTask(async () => {
  const snapshot = await api.captureSnapshot();
  const screenshot = await api.getScreenshot({ id: snapshot.id });
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, screenshot);
  message.success(`捕获并保存快照成功`);
  await loadSnapshots();
});
const downloadAllSnapshot = useTask(async () => {
  const snapshotIds = (await api.getSnapshots()).map((s) => s.id);
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
          api.getSnapshot({ id: snapshotId }),
          api.getScreenshot({ id: snapshotId }),
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
const previewSnapshot = useBatchTask(
  async (row: Snapshot) => {
    if (!(await snapshotStorage.hasItem(row.id))) {
      const obj = await api.getSnapshot({ id: row.id });
      await snapshotStorage.setItem(row.id, obj);
    }
    if (!(await screenshotStorage.hasItem(row.id))) {
      const bf = await api.getScreenshot({ id: row.id });
      await screenshotStorage.setItem(row.id, bf);
    }
    window.open(
      router.resolve({
        name: 'snapshot',
        params: { snapshotId: row.id },
      }).href,
    );
  },
  (r) => r.id,
);

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
        <ActionCard
          snapshot={row}
          showExport={false}
          showShare={false}
          deleteConfirmText={`是否确认删除? 此操作不可恢复!\n快照ID:${row.id}`}
          onPreview={() => previewSnapshot.invoke(row)}
          previewLoading={previewSnapshot.loading[row.id]}
          onBeforeDelete={async () => await api.deleteSnapshot({ id: row.id })}
          onDelete={() => {
            snapshots.value = snapshots.value.filter((s) => s.id !== row.id);
          }}
        />
      );
    },
  },
];

const checkedRowKeys = ref<number[]>([]);
const { batchDelete } = useBatchActions(checkedRowKeys, {
  beforeDeleteItem: async (id) => await api.deleteSnapshot({ id }),
  onAfterDelete: async () => {
    await loadSnapshots();
  },
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
  connectionVersion++;
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
  <div page-size flex flex-col p-10px gap-10px>
    <div flex items-center gap-24px>
      <RouterLink to="/" class="flex ml-12px" title="首页">
        <NButton text style="--n-icon-size: 24px">
          <template #icon>
            <SvgIcon name="arrow" class="rotate-90" />
          </template>
        </NButton>
      </RouterLink>
      <NInputGroup>
        <NInput
          :value="link"
          placeholder="请输入设备地址"
          class="gkd_code"
          :style="{ width: `240px` }"
          @keyup.enter="connect.invoke"
          @update:value="updateLink"
        >
          <template #suffix>
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  style="--n-icon-size: 20px"
                  :loading="connect.loading"
                  @click="connect.invoke"
                >
                  <template #icon><SvgIcon name="refresh" /></template>
                </NButton>
              </template>
              刷新连接
            </NTooltip>
          </template>
        </NInput>
        <NButton
          v-if="connect.loading"
          secondary
          type="error"
          @click="stopConnection"
        >
          停止
        </NButton>

        <div
          v-if="serverInfo"
          gkd_code
          pl-16px
          whitespace-nowrap
          flex
          items-center
        >
          {{ serverTitle }}
        </div>
      </NInputGroup>
      <template v-if="serverInfo">
        <BatchActionsBar
          :checkedCount="checkedRowKeys.length"
          :batchDelete="batchDelete"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="captureSnapshot.loading"
              @click="captureSnapshot.invoke"
            >
              <template #icon><SvgIcon name="Snapshot" /></template>
            </NButton>
          </template>
          捕获快照
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="downloadAllSnapshot.loading"
              @click="downloadAllSnapshot.invoke"
            >
              <template #icon><SvgIcon name="Down-all" /></template>
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
              <template #icon><SvgIcon name="CacheSub" /></template>
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
              <template #icon><SvgIcon name="Exe-Sel" /></template>
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
