<script setup lang="tsx">
import { useDeviceApi } from '@/utils/api';
import { toValidURL } from '@/utils/check';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { delay } from '@/utils/others';
import { snapshotStorage, screenshotStorage } from '@/utils/storage';
import { useSnapshotColumns } from '@/utils/table';
import { useBatchTask, useTask } from '@/utils/task';
import type { Device, Snapshot } from '@/utils/types';
import { useStorage, useTitle } from '@vueuse/core';
import {
  DataTableColumns,
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NSpace,
  PaginationProps,
} from 'naive-ui';
import { SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';
import {
  onMounted,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
  watchEffect,
} from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const title = useTitle(`新设备`);
const { api, origin } = useDeviceApi();
const link = useStorage(`device_link`, ``);
const device = shallowRef<Device>();
const connect = useTask(async () => {
  if (!link.value) return;
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  device.value = await api.device();
});
onMounted(async () => {
  await delay(500);
  if (toValidURL(link.value)) {
    connect.invoke();
  }
});

const snapshots = shallowRef<Snapshot[]>([]);
watchEffect(async () => {
  if (!device.value) return;
  title.value = `已连接 ` + device.value.manufacturer;
  const result = await api.snapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
});

const captureSnapshot = useTask(async () => {
  const snapshot = await api.snapshot();
  const screenshot = await api.screenshot({ id: snapshot.id });
  message.success(`抓取快照成功`);
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, screenshot);
  message.success(`保存快照成功`);
  const result = await api.snapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
});
const downloadAllSnapshot = useTask(async () => {
  const snapshotIds = (await api.snapshots()).map((s) => s.id);
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
          api.snapshot({ id: snapshotId }),
          api.screenshot({ id: snapshotId }),
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
  reseColWidth,
} = useSnapshotColumns();
const handleSorterChange = (sorter: SortState) => {
  if (sorter.columnKey == ctimeCol.key) {
    ctimeCol.sortOrder = sorter.order;
  }
};
const previewSnapshot = useBatchTask(
  async (row: Snapshot) => {
    if (!(await snapshotStorage.hasItem(row.id))) {
      await snapshotStorage.setItem(row.id, await api.snapshot({ id: row.id }));
    }
    if (!(await screenshotStorage.hasItem(row.id))) {
      const bf = await api.screenshot({ id: row.id });
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
  ctimeCol,
  appNameCol,
  appIdCol,
  appVersionCodeCol,
  appVersionNameCol,
  activityIdCol,
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `120px`,
    render(row) {
      return (
        <NSpace size="small">
          <NButton
            size="small"
            loading={previewSnapshot.loading[row.id]}
            onClick={() => previewSnapshot.invoke(row)}
          >
            查看
          </NButton>
        </NSpace>
      );
    },
  },
];

const pagination = shallowReactive<PaginationProps>({
  page: 1,
  pageSize: 50,
  showSizePicker: true,
  pageSizes: [50, 100],
  onChange: (page: number) => {
    pagination.page = page;
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
  },
});
watch(pagination, reseColWidth);
</script>
<template>
  <div flex flex-col p-10px gap-10px h-full>
    <NSpace>
      <RouterLink to="/">
        <NButton> 首页 </NButton>
      </RouterLink>
      <NInputGroup>
        <NInput
          v-model:value="link"
          placeholder="请输入设备地址"
          :style="{ minWidth: `250px` }"
          @keyup.enter="connect.invoke"
        ></NInput>
        <NButton ghost @click="connect.invoke" :loading="connect.loading">
          连接
        </NButton>
      </NInputGroup>
      <template v-if="device">
        <div class="h-full" flex flex-items-center>
          {{ `已连接 ${device.manufacturer} Android ${device.release}` }}
        </div>
        <NButton
          ghost
          @click="captureSnapshot.invoke"
          :loading="captureSnapshot.loading"
        >
          快照
        </NButton>
        <NButton
          ghost
          @click="downloadAllSnapshot.invoke"
          :loading="downloadAllSnapshot.loading"
        >
          下载设备所有快照
        </NButton>
      </template>
    </NSpace>
    <NDataTable
      striped
      flexHeight
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      @update:sorter="handleSorterChange"
      size="small"
      class="flex-1"
      :scrollX="1200"
    />
  </div>
</template>
