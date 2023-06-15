<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { toValidURL } from '@/utils/check';
import { showTextDLg } from '@/utils/dialog';
import { dialog } from '@/utils/discrete';
import {
  batchCreatePngUrl,
  batchCreateZipUrl,
  batchPngDownloadZip,
  batchZipDownloadZip,
} from '@/utils/export';
import { importFromLocal, importFromNetwork } from '@/utils/import';
import { shallowSnapshotStorage, snapshotStorage } from '@/utils/storage';
import { renderDveice, useSnapshotColumns } from '@/utils/table';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import {
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NModal,
  NPopover,
  NSpace,
  PaginationProps,
  type DataTableColumns,
} from 'naive-ui';
import type { SortState } from 'naive-ui/es/data-table/src/interface';
import {
  computed,
  reactive,
  shallowReactive,
  shallowRef,
  watch,
  watchEffect,
} from 'vue';
import { RouterLink } from 'vue-router';

const snapshots = shallowRef<Snapshot[]>([]);
const updateSnapshots = async () => {
  snapshots.value = (await shallowSnapshotStorage.getAllItems()).reverse();
  checkedRowKeys.value = [];
};
updateSnapshots();
const filterOption = shallowReactive({
  query: ``,
  actualQuery: ``,
  updateQuery: () => {
    filterOption.actualQuery = filterOption.query.trim();
    checkedRowKeys.value = [];
  },
});
const filterSnapshots = computed(() => {
  const actualQuery = filterOption.actualQuery;
  if (!actualQuery) return snapshots.value;
  return snapshots.value.filter((s) => {
    return (
      s.appName.includes(actualQuery) ||
      s.appId.includes(actualQuery) ||
      s.activityId.includes(actualQuery)
    );
  });
});

const importLoacl = useTask(async () => {
  await importFromLocal();
  await updateSnapshots();
});

const { activityIdCol, appIdCol, appNameCol, ctimeCol, deviceCol } =
  useSnapshotColumns();

watchEffect(() => {
  const set = filterSnapshots.value.reduce(
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

watchEffect(() => {
  const set = filterSnapshots.value.reduce(
    (p, c) => (p.add(c.appName), p),
    new Set<string>(),
  );
  if (set.size <= 1) {
    appNameCol.filterOptions = undefined;
    return;
  }
  appNameCol.filterOptions = [...set.values()].map((s) => ({
    value: s,
    label: s,
  }));
});

watchEffect(() => {
  const set = filterSnapshots.value.reduce(
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
  appNameCol,
  appIdCol,
  activityIdCol,
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `255px`,
    render(row) {
      return <ActionCard snapshot={row} onDelete={updateSnapshots} />;
    },
  },
]);

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
watch(pagination, () => {
  deviceCol.width = undefined;
  appNameCol.width = undefined;
  appIdCol.width = undefined;
});

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
const checkedSnapshots = () => {
  return Promise.all(
    checkedRowKeys.value.map(
      (id) => snapshotStorage.getItem(id) as Promise<Snapshot>,
    ),
  );
};
const batchDelete = useTask(async () => {
  await new Promise((res, rej) => {
    dialog.warning({
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

  await Promise.all(
    checkedRowKeys.value.map((k) => snapshotStorage.removeItem(k)),
  );
  await updateSnapshots();
});
const batchDownloadPng = useTask(async () => {
  await batchPngDownloadZip(await checkedSnapshots());
});
const batchDownloadZip = useTask(async () => {
  await batchZipDownloadZip(await checkedSnapshots());
});

const batchSharePngUrl = useTask(async () => {
  const policiesAssets = await batchCreatePngUrl(await checkedSnapshots());
  showTextDLg({
    content: policiesAssets.map((s) => s.href).join(`\n`) + `\n`,
  });
});
const batchShareZipUrl = useTask(async () => {
  const policiesAssets = await batchCreateZipUrl(await checkedSnapshots());
  showTextDLg({
    content: policiesAssets.map((s) => s.href).join(`\n`) + `\n`,
  });
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
    style="width: 800px"
    @positive-click="importNetwork.invoke"
    :loading="importNetwork.loading"
  >
    <NInput
      :value="text"
      @update:value="
        if (!importNetwork.loading) {
          text = $event;
        }
      "
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
  <div flex flex-col p-10px gap-10px h-full>
    <div flex>
      <NSpace>
        <NInputGroup>
          <NInput
            placeholder="请输入关键字搜索"
            clearable
            v-model:value="filterOption.query"
            @keyup.enter="filterOption.updateQuery"
            @change="filterOption.updateQuery"
          ></NInput>
          <NButton @click="filterOption.updateQuery"> 搜索 </NButton>
        </NInputGroup>
        <template v-if="checkedRowKeys.length">
          <NPopover>
            <template #trigger>
              <NButton> 批量下载 </NButton>
            </template>
            <NSpace vertical>
              <NButton
                @click="batchDownloadPng.invoke"
                :loading="batchDownloadPng.loading"
              >
                批量下载-png
              </NButton>
              <NButton
                @click="batchDownloadZip.invoke"
                :loading="batchDownloadZip.loading"
              >
                批量下载-zip
              </NButton>
            </NSpace>
          </NPopover>
          <NPopover>
            <template #trigger>
              <NButton> 批量分享 </NButton>
            </template>
            <NSpace vertical>
              <NButton
                @click="batchSharePngUrl.invoke"
                :loading="batchSharePngUrl.loading"
              >
                批量生成链接-png
              </NButton>
              <NButton
                @click="batchShareZipUrl.invoke"
                :loading="batchShareZipUrl.loading"
              >
                批量生成链接-zip
              </NButton>
            </NSpace>
          </NPopover>
          <NButton @click="batchDelete.invoke"> 批量删除 </NButton>
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
            <NButton @click="importLoacl.invoke" :loading="importLoacl.loading">
              导入本地文件
            </NButton>
            <NButton @click="showModal = true" :loading="importNetwork.loading">
              导入网络文件
            </NButton>
          </NSpace>
        </NPopover>
        <RouterLink to="/device">
          <NButton> 去连接设备 </NButton>
        </RouterLink>
      </NSpace>
    </div>
    <NDataTable
      striped
      :data="filterSnapshots"
      :columns="columns"
      :scroll-x="1700"
      :pagination="pagination"
      v-model:checked-row-keys="checkedRowKeys"
      :row-key="(r:Snapshot)=>r.id"
      @update:sorter="handleSorterChange"
      size="small"
      class="flex-1"
      flex-height
    />
  </div>
</template>
