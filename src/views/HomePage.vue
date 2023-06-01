<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { toValidURL } from '@/utils/check';
import { importFromLocal, importFromNetwork } from '@/utils/import';
import { storage } from '@/utils/storage';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import dayjs from 'dayjs';
import {
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NModal,
  NPopover,
  NSpace,
  type DataTableColumns,
} from 'naive-ui';
import type {
  SortState,
  TableBaseColumn,
} from 'naive-ui/es/data-table/src/interface';
import { reactive, shallowReactive, shallowRef, watchEffect } from 'vue';
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

const ctimeCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `id`,
  title: `创建时间`,
  fixed: 'left',
  width: `130px`,
  sortOrder: false,
  sorter(rowA, rowB) {
    return rowA.id - rowB.id;
  },
  render(row) {
    return dayjs(row.id).format('MM-DD HH:mm:ss');
  },
});
const renderDveice = (row: Snapshot) => {
  if (!row.device) return ``;
  return `${row.device.manufacturer} ${row.device.model} Android${row.device.release}`;
};
const deviceCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `versionRelease`,
  width: `250px`,
  title: `设备`,
  filterMultiple: true,
  filter(value, row) {
    return renderDveice(row).includes(value.toString());
  },
  render(row) {
    return renderDveice(row);
  },
});

watchEffect(() => {
  const set = snapshots.value.reduce(
    (p, c) => (p.add(renderDveice(c)), p),
    new Set<string>(),
  );
  if (set.size <= 1) {
    deviceCol.filterOptions = undefined;
    return;
  }
  deviceCol.filterOptions = [...set.values()].map((s) => ({
    value: s,
    label: s,
  }));
});

const nameCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `appName`,
  title: `name`,
  width: `130px`,
  filterMultiple: true,
  filter(value, row) {
    return value.toString() == row.appName;
  },
  render(row) {
    return row.appName;
  },
});

watchEffect(() => {
  const set = snapshots.value.reduce(
    (p, c) => (p.add(c.appName), p),
    new Set<string>(),
  );
  if (set.size <= 1) {
    nameCol.filterOptions = undefined;
    return;
  }
  nameCol.filterOptions = [...set.values()].map((s) => ({
    value: s,
    label: s,
  }));
});

const appIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `appId`,
  title: `appId`,
  width: `260px`,
  render(row) {
    return row.appId;
  },
});

const activityIdCol = shallowReactive<TableBaseColumn<Snapshot>>({
  key: `activityId`,
  title: `activityId`,
  className: `whitespace-nowrap`,
  filterMultiple: true,
  filter(value, row) {
    return value.toString() == row.activityId;
  },
  render(row) {
    return row.activityId;
  },
});

watchEffect(() => {
  const set = snapshots.value.reduce(
    (p, c) => (p.add(c.activityId), p),
    new Set<string>(),
  );
  if (set.size <= 1) {
    activityIdCol.filterOptions = undefined;
    return;
  }
  activityIdCol.filterOptions = [...set.values()].map((s) => ({
    value: s,
    label: s,
  }));
});

const columns: DataTableColumns<Snapshot> = reactive([
  {
    type: 'selection',
  },
  ctimeCol,
  deviceCol,
  nameCol,
  appIdCol,
  activityIdCol,
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `290px`,
    render(row, index) {
      return <ActionCard snapshot={row} onDelete={updateSnapshots} />;
    },
  },
]);

const handleSorterChange = (sorter: SortState) => {
  if (sorter.columnKey == ctimeCol.key) {
    ctimeCol.sortOrder = sorter.order;
  }
};

const showModal = shallowRef(false);
const text = shallowRef(``);
const importNetwork = useTask(async () => {
  const urls = text.value
    .trim()
    .split(`\n`)
    .map((u) => u.trim())
    .filter((u) => toValidURL(u));
  if (urls.length == 0) return;
  await importFromNetwork(urls);
  await updateSnapshots();
  text.value = ``;
});

const checkedRowKeys = shallowRef<number[]>([]);
</script>
<template>
  <NModal
    v-model:show="showModal"
    preset="dialog"
    title="导入网络文件"
    :show-icon="false"
    positive-text="确认"
    negative-text="取消"
    style="width: 800px"
    @positive-click="importNetwork.invoke"
    :loading="importNetwork.loading"
  >
    <NInput
      v-model:value="text"
      type="textarea"
      :placeholder="`请输入文件链接\n每行一个\n空白行自动忽略\n非法链接行自动忽略`"
      :autosize="{
        minRows: 8,
        maxRows: 16,
      }"
      :input-props="{
        style: `white-space: nowrap;`,
      }"
    />
  </NModal>
  <div flex flex-col p-10px gap-10px>
    <div flex>
      <NSpace>
        <NInputGroup>
          <NInput placeholder="请输入关键字搜索"></NInput>
          <NButton> 搜索 </NButton>
        </NInputGroup>
        <template v-if="checkedRowKeys.length">
          <NButton> 批量导出 </NButton>
          <NButton> 批量分享 </NButton>
          <NButton> 批量删除 </NButton>
          <div h-full flex flex-items-center>
            {{ `已选中 ${checkedRowKeys.length} 个快照` }}
          </div>
        </template>
      </NSpace>
      <div flex-1></div>
      <NSpace>
        <NPopover>
          <template #trigger>
            <NButton> 导入 </NButton>
          </template>
          <NSpace vertical>
            <NButton @click="importLoacl.invoke"> 导入本地文件 </NButton>
            <NButton @click="showModal = true"> 导入网络文件 </NButton>
          </NSpace>
        </NPopover>
        <RouterLink to="/device">
          <NButton> 去连接设备 </NButton>
        </RouterLink>
      </NSpace>
    </div>
    <NDataTable
      striped
      :data="snapshots"
      :columns="columns"
      :scroll-x="1200"
      v-model:checked-row-keys="checkedRowKeys"
      :row-key="(r:Snapshot)=>r.id"
      @update:sorter="handleSorterChange"
      size="small"
      class="h-85vh"
      flex-height
    />
  </div>
</template>
