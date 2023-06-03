<script setup lang="tsx">
import { useDeviceApi } from '@/utils/api';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { storage } from '@/utils/storage';
import { useTask } from '@/utils/task';
import type { Device, Snapshot } from '@/utils/types';
import { useStorage, useTitle } from '@vueuse/core';
import dayjs from 'dayjs';
import {
  DataTableColumns,
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NSpace,
  PaginationProps,
  NEllipsis,
} from 'naive-ui';
import {
  onMounted,
  reactive,
  shallowReactive,
  shallowRef,
  toRaw,
  watchEffect,
} from 'vue';
import { useRouter } from 'vue-router';
import pLimit from 'p-limit';
import { TableBaseColumn } from 'naive-ui/es/data-table/src/interface';
import { delay } from '@/utils/others';
import { toValidURL } from '@/utils/check';

const router = useRouter();
const title = useTitle(`新设备`);
const { api, origin } = useDeviceApi();
const link = useStorage(`device_link`, ``);
const device = shallowRef<Device>();
const snapshotIds = shallowRef<number[]>([]);
watchEffect(async () => {
  if (!device.value) return;
  title.value =
    `已连接 ` + device.value.manufacturer + `\x20` + device.value.release;
  const result = await api.snapshotIds();
  result.sort((a, b) => b - a);
  snapshotIds.value = result;
});
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
const captureSnapshot = useTask(async () => {
  const snapshot = await api.snapshot();
  message.success(`抓取快照成功`);
  await Promise.all([
    storage.setSnapshot(snapshot),
    api.screenshot({ id: snapshot.id }).then((screenshot) => {
      return storage.setScreenshot(snapshot.id, screenshot);
    }),
  ]);
  message.success(`保存快照成功`);
  const result = await api.snapshotIds();
  result.sort((a, b) => b - a);
  snapshotIds.value = result;
});
const downloadAllSnapshot = useTask(async () => {
  const snapshotIds = await api.snapshotIds();
  const unimportSnapshotIds: number[] = [];
  for (const snapshotId of snapshotIds) {
    const sn = await storage.getSnapshot(snapshotId);
    if (!sn) {
      unimportSnapshotIds.push(snapshotId);
    }
  }
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
          storage.setSnapshot(newSnapshot),
          storage.setScreenshot(snapshotId, newScreenshot),
        ]);
        r++;
      }),
    ),
  );
  message.success(`导入${r}条新记录`);
  // updateSnapshots();
});
const ctimeCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `id`,
  title: `创建时间`,
  fixed: 'left',
  width: `130px`,
  render(row) {
    return dayjs(row.id).format('MM-DD HH:mm:ss');
  },
});
const nameCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `appName`,
  title: `name`,
  width: `150px`,
  render(row) {
    return <NEllipsis> {row.appName} </NEllipsis>;
  },
});
const appIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `appId`,
  title: `appId`,
  width: `280px`,
  render(row) {
    return row.appId;
  },
});
const activityIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `activityId`,
  title: `activityId`,
  className: `whitespace-nowrap`,
  render(row) {
    return row.activityId;
  },
});
const columns: DataTableColumns<Snapshot> = [
  ctimeCol,
  nameCol,
  appIdCol,
  activityIdCol,
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `320px`,
    render(row, index) {
      return (
        <NSpace size="small">
          <NButton
            size="small"
            onClick={async () => {
              if (!(await storage.hasSnapshot(row.id))) {
                await storage.setSnapshot(toRaw(row));
              }
              if (!(await storage.hasScreenshot(row.id))) {
                const bf = await api.screenshot({ id: row.id });
                await storage.setScreenshot(row.id, bf);
              }
              window.open(
                router.resolve({
                  name: 'snapshot',
                  params: { snapshotId: row.id },
                }).href,
              );
            }}
          >
            查看
          </NButton>
          <NButton size="small">下载-zip</NButton>
          <NButton size="small">下载-png</NButton>
          <NButton size="small">删除</NButton>
        </NSpace>
      );
    },
  },
];
const snapshots = shallowRef<Snapshot[]>([]);
const pagination = reactive<
  PaginationProps & { page: number; pageCount: number; pageSize: number }
>({
  page: 1,
  pageCount: 0,
  pageSize: 50,
});
const handlePageChange = async (currentPage = 1) => {
  const result = await Promise.all(
    snapshotIds.value
      .slice(
        (currentPage - 1) * pagination.pageSize,
        currentPage * pagination.pageSize,
      )
      .map(async (snapshotId) => api.snapshot({ id: snapshotId })),
  );
  pagination.page = currentPage;
  snapshots.value = result;
};
watchEffect(() => {
  pagination.pageCount = Math.ceil(
    snapshotIds.value.length / pagination.pageSize,
  );
  handlePageChange();
});
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
      flex-height
      remote
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      size="small"
      class="flex-1"
      :scroll-x="1200"
      @update:page="handlePageChange"
    />
  </div>
</template>
