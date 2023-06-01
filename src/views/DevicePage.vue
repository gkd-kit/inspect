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
} from 'naive-ui';
import { reactive, shallowRef, toRaw, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import pLimit from 'p-limit';

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
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  device.value = await api.device();
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

const columns: DataTableColumns<Snapshot> = [
  {
    key: `id`,
    title: `创建时间`,
    render(row) {
      return dayjs(row.id).format('MM-DD HH:mm:ss');
    },
  },
  {
    key: `appName`,
    title: `name`,
    render(row) {
      return row.appName;
    },
  },
  {
    key: `appId`,
    title: `appId`,
    render(row) {
      return row.appId;
    },
  },
  {
    key: `activityId`,
    title: `activityId`,
    render(row) {
      return row.activityId;
    },
  },
  {
    key: `actions`,
    minWidth: 250,
    title: `操作`,
    render(row, index) {
      return (
        <NSpace>
          <NButton
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
          <NButton>下载-zip</NButton>
          <NButton>下载-png</NButton>
          <NButton>删除</NButton>
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
  pageSize: 10,
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
  <div flex p-5px flex-col gap-5px>
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
      remote
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      size="small"
      @update:page="handlePageChange"
    />
  </div>
</template>
