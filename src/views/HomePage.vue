<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { delay } from '@/utils';
import { importFromLocal, importFromNetwork } from '@/utils/import';
import { storage } from '@/utils/storage';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import { useWindowSize } from '@vueuse/core';
import dayjs from 'dayjs';
import {
  NButton,
  NDataTable,
  NInput,
  NModal,
  NSpace,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui';
import { reactive, shallowRef } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

const router = useRouter();

const snapshots = shallowRef<Snapshot[]>([]);
const updateSnapshots = async () => {
  snapshots.value = (await storage.getAllSnapshots()).reverse();
};

updateSnapshots();

const importLoacl = useTask(async () => {
  await importFromLocal();
  await updateSnapshots();
});

const columns: DataTableColumns<Snapshot> = [
  {
    key: `id`,
    title: `创建时间`,
    fixed: 'left',
    width: `130px`,
    render(row) {
      return dayjs(row.id).format('MM-DD HH:mm:ss');
    },
  },
  {
    key: `versionRelease`,
    width: `250px`,
    title: `设备`,
    render(row) {
      if (!row.device) return ``;
      return `${row.device.manufacturer} ${row.device.model} Android${row.device.release}`;
    },
  },
  {
    key: `appName`,
    title: `name`,
    width: `130px`,
    render(row) {
      return row.appName;
    },
  },
  {
    key: `appId`,
    title: `appId`,
    width: `250px`,
    render(row) {
      return row.appId;
    },
  },
  {
    key: `activityId`,
    title: `activityId`,
    className: `whitespace-nowrap`,
    render(row) {
      return row.activityId;
    },
  },
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `290px`,
    render(row, index) {
      return <ActionCard snapshot={row} onDelete={updateSnapshots} />;
    },
  },
];

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 30],
  onChange: (page: number) => {
    pagination.page = page;
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
  },
});

const showModal = shallowRef(false);
const text = shallowRef(``);
const importNetwork = useTask(async () => {
  const urls = text.value
    .trim()
    .split(`\n`)
    .map((u) => u.trim())
    .filter((u) => {
      try {
        new URL(u);
        return true;
      } catch {}
      return false;
    });
  if (urls.length == 0) return;
  await importFromNetwork(urls);
  await updateSnapshots();
  text.value = ``;
});
</script>
<template>
  <NModal
    v-model:show="showModal"
    preset="dialog"
    title="导入网络文件"
    :show-icon="false"
    positive-text="确认"
    negative-text="取消"
    style="width: 600px"
    @positive-click="importNetwork.invoke"
    :loading="importNetwork.loading"
  >
    <NInput
      v-model:value="text"
      type="textarea"
      :placeholder="`请输入文件链接\n每行一个\n空白行自动忽略\n非法链接行自动忽略`"
      :autosize="{
        minRows: 5,
        maxRows: 10,
      }"
    />
  </NModal>
  <div flex flex-col p-10px gap-10px>
    <NSpace>
      <NButton size="small" @click="importLoacl.invoke"> 导入本地文件 </NButton>
      <NButton size="small" @click="showModal = true"> 导入网络文件 </NButton>
      <RouterLink to="/device">
        <NButton size="small"> 去连接设备 </NButton>
      </RouterLink>
    </NSpace>
    <NDataTable
      striped
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      :scroll-x="1200"
      size="small"
      class="h-85vh"
      flex-height
    />
  </div>
</template>
