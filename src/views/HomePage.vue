<script lang="tsx" setup>
import { delay, useThrottle } from '@/utils';
import { useDeviceApi } from '@/utils/api';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import storage from '@/utils/storage';
import type { Device, Snapshot, WindowData } from '@/utils/types';
import { exportSnapshotAsZip } from '@/utils/zip';
import { fileOpen } from 'browser-fs-access';
import dayjs from 'dayjs';
import { loadAsync } from 'jszip';
import {
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NSpace,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const snapshots = ref<Snapshot[]>([]);
const updateSnapshots = async () => {
  snapshots.value = (await storage.getAllSnapshots()).reverse();
};

updateSnapshots();

const preview = (snapshot: Snapshot) => {
  window.open(
    router.resolve({
      name: 'snapshot',
      params: { snapshotId: snapshot.id },
    }).href,
  );
};

const executors = computed(() => {
  return snapshots.value.map(() => useThrottle(exportSnapshotAsZip));
});

const importZipAsSnapshot = useThrottle(async () => {
  const files = (
    await fileOpen({
      multiple: true,
    })
  ).filter((f) => f.name.endsWith(`.zip`));
  if (files.length == 0) {
    message.warning(`没有发现压缩文件`);
    return;
  }
  await Promise.any(
    Array.from(files).map(async (file) => {
      const zip = await loadAsync(file);
      const snapshotFile = zip.file(`snapshot.json`);
      const windowFile = zip.file(`window.json`);
      const screenshotFile = zip.file(`screenshot.png`);
      if (!snapshotFile || !windowFile || !screenshotFile) {
        return;
      }
      const snapshot = JSON.parse(
        await snapshotFile.async('string'),
      ) as Snapshot;
      const windowx = JSON.parse(
        await windowFile.async('string'),
      ) as WindowData;
      const screenshot = await screenshotFile.async('arraybuffer');
      await storage.setSnapshot(snapshot);
      await storage.setWindow(snapshot.id, windowx);
      await storage.setScreenshot(snapshot.id, screenshot);
    }),
  );
  await updateSnapshots();
});

const deleteSnapshot = async (snapshot: Snapshot) => {
  await storage.deleteSnapshot(snapshot.id);
  await delay(500);
  await updateSnapshots();
};

const deleteExecutors = computed(() => {
  return snapshots.value.map(() => useThrottle(deleteSnapshot));
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
    key: `versionRelease`,
    title: `设备`,
    render(row) {
      return `${row.manufacturer} ${row.model} Android${row.versionRelease}`;
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
            onClick={() => {
              preview(row);
            }}
          >
            查看
          </NButton>
          <NButton
            onClick={() => {
              executors.value[index].invoke(row);
            }}
            loading={executors.value[index].loading}
          >
            导出
          </NButton>
          <NButton
            onClick={() => {
              deleteExecutors.value[index].invoke(row);
            }}
            loading={deleteExecutors.value[index].loading}
          >
            删除
          </NButton>
        </NSpace>
      );
    },
  },
];

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10],
  onChange: (page: number) => {
    pagination.page = page;
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
  },
}) as PaginationProps;

const { api, origin } = useDeviceApi();
const link = ref(``);
const device = ref<Device>();
const connect = useThrottle(async () => {
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  device.value = await api.device();
});
const captureSnapshot = useThrottle(async () => {
  const snapshot = await api.capture();
  message.success(`抓取快照成功`);
  await Promise.all([
    storage.setSnapshot(snapshot),
    storage.setWindow(snapshot.id, await api.window({ id: snapshot.id })),
    api.screenshot({ id: snapshot.id }).then((screenshot) => {
      return storage.setScreenshot(snapshot.id, screenshot);
    }),
  ]);
  message.success(`保存快照成功`);
  updateSnapshots();
});
</script>
<template>
  <div flex flex-col p-10px gap-10px>
    <NSpace>
      <NButton @click="importZipAsSnapshot.invoke"> 导入 </NButton>
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
        <div class="h-100%" flex flex-items-center>
          {{ `已连接 ${device.manufacturer} Android ${device.release}` }}
        </div>
        <NButton
          v-if="device"
          ghost
          @click="captureSnapshot.invoke"
          :loading="captureSnapshot.loading"
        >
          快照
        </NButton>
      </template>
    </NSpace>
    <NDataTable :data="snapshots" :columns="columns" :pagination="pagination" />
  </div>
</template>
