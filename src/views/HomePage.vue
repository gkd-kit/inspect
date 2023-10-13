<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { toValidURL } from '@/utils/check';
import { showTextDLg } from '@/utils/dialog';
import { dialog } from '@/utils/discrete';
import {
  batchCreateJpgUrl,
  batchCreateZipUrl,
  batchJpgDownloadZip,
  batchZipDownloadZip,
} from '@/utils/export';
import { importFromLocal, importFromNetwork } from '@/utils/import';
import { shallowSnapshotStorage, snapshotStorage } from '@/utils/storage';
import { renderDveice, useSnapshotColumns } from '@/utils/table';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import { githubUrlToSelfUrl } from '@/utils/url';
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
  NIcon,
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
      (s.appName || ``).includes(actualQuery) ||
      (s.appId || ``).includes(actualQuery) ||
      (s.activityId || ``).includes(actualQuery)
    );
  });
});

const importLoacl = useTask(async () => {
  await importFromLocal();
  await updateSnapshots();
});

const {
  activityIdCol,
  appIdCol,
  appNameCol,
  ctimeCol,
  deviceCol,
  appVersionCodeCol,
  appVersionNameCol,
  reseColWidth,
} = useSnapshotColumns();

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
  appVersionCodeCol,
  appVersionNameCol,
  activityIdCol,
  {
    key: `actions`,
    title: `操作`,
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
watch(pagination, reseColWidth);

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
const batchDownloadJpg = useTask(async () => {
  await batchJpgDownloadZip(await checkedSnapshots());
});
const batchDownloadZip = useTask(async () => {
  await batchZipDownloadZip(await checkedSnapshots());
});

const batchShareJpgUrl = useTask(async () => {
  const pngUrls = await batchCreateJpgUrl(await checkedSnapshots());
  showTextDLg({
    content: pngUrls.map((s) => githubUrlToSelfUrl(s)).join(`\n`) + `\n`,
  });
});
const batchShareZipUrl = useTask(async () => {
  const zipUrls = await batchCreateZipUrl(await checkedSnapshots());
  showTextDLg({
    content: zipUrls.map((s) => githubUrlToSelfUrl(s)).join(`\n`) + `\n`,
  });
});
</script>
<template>
  <NModal
    v-model:show="showModal"
    preset="dialog"
    title="导入网络文件"
    :showIcon="false"
    positiveText="确认"
    negativeText="取消"
    style="width: 800px"
    @positiveClick="importNetwork.invoke"
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
      :placeholder="`仅支持ZIP文件链接\n每行一个\n空白行自动忽略\n非法链接行自动忽略`"
      :autosize="{
        minRows: 8,
        maxRows: 16,
      }"
      :inputProps="{
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
                @click="batchDownloadJpg.invoke"
                :loading="batchDownloadJpg.loading"
              >
                批量下载-jpg
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
                @click="batchShareJpgUrl.invoke"
                :loading="batchShareJpgUrl.loading"
              >
                批量生成链接-jpg
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
        <a
          href="https://github.com/gkd-kit/inspect"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NButton>
            <template #icon>
              <NIcon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 496 512"
                >
                  <path
                    d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6c-3.3.3-5.6-1.3-5.6-3.6c0-2 2.3-3.6 5.2-3.6c3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9c2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9c.3 2 2.9 3.3 5.9 2.6c2.9-.7 4.9-2.6 4.6-4.6c-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2c12.8 2.3 17.3-5.6 17.3-12.1c0-6.2-.3-40.4-.3-61.4c0 0-70 15-84.7-29.8c0 0-11.4-29.1-27.8-36.6c0 0-22.9-15.7 1.6-15.4c0 0 24.9 2 38.6 25.8c21.9 38.6 58.6 27.5 72.9 20.9c2.3-16 8.8-27.1 16-33.7c-55.9-6.2-112.3-14.3-112.3-110.5c0-27.5 7.6-41.3 23.6-58.9c-2.6-6.5-11.1-33.3 2.6-67.9c20.9-6.5 69 27 69 27c20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27c13.7 34.7 5.2 61.4 2.6 67.9c16 17.7 25.8 31.5 25.8 58.9c0 96.5-58.9 104.2-114.8 110.5c9.2 7.9 17 22.9 17 46.4c0 33.7-.3 75.4-.3 83.6c0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252C496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2c1.6 1.6 3.9 2.3 5.2 1c1.3-1 1-3.3-.7-5.2c-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9c1.6 1 3.6.7 4.3-.7c.7-1.3-.3-2.9-2.3-3.9c-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2c2.3 2.3 5.2 2.6 6.5 1c1.3-1.3.7-4.3-1.3-6.2c-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9c1.6 2.3 4.3 3.3 5.6 2.3c1.6-1.3 1.6-3.9 0-6.2c-1.4-2.3-4-3.3-5.6-2z"
                    fill="currentColor"
                  ></path>
                </svg>
              </NIcon>
            </template>
          </NButton>
        </a>
        <NPopover>
          <template #trigger>
            <NButton>
              <template #icon>
                <NIcon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                    viewBox="0 0 512 512"
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="32"
                      d="M256 112v288"
                    ></path>
                    <path
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="32"
                      d="M400 256H112"
                    ></path>
                  </svg>
                </NIcon>
              </template>
            </NButton>
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
          <NButton>
            <template #icon>
              <NIcon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 1024 1024"
                >
                  <path
                    d="M270.1 741.7c0 23.4 19.1 42.5 42.6 42.5h48.7v120.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V784.1h85v120.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V784.1h48.7c23.5 0 42.6-19.1 42.6-42.5V346.4h-486v395.3zm357.1-600.1l44.9-65c2.6-3.8 2-8.9-1.5-11.4c-3.5-2.4-8.5-1.2-11.1 2.6l-46.6 67.6c-30.7-12.1-64.9-18.8-100.8-18.8c-35.9 0-70.1 6.7-100.8 18.8l-46.6-67.5c-2.6-3.8-7.6-5.1-11.1-2.6c-3.5 2.4-4.1 7.4-1.5 11.4l44.9 65c-71.4 33.2-121.4 96.1-127.8 169.6h486c-6.6-73.6-56.7-136.5-128-169.7zM409.5 244.1a26.9 26.9 0 1 1 26.9-26.9a26.97 26.97 0 0 1-26.9 26.9zm208.4 0a26.9 26.9 0 1 1 26.9-26.9a26.97 26.97 0 0 1-26.9 26.9zm223.4 100.7c-30.2 0-54.6 24.8-54.6 55.4v216.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V400.1c.1-30.6-24.3-55.3-54.6-55.3zm-658.6 0c-30.2 0-54.6 24.8-54.6 55.4v216.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V400.1c0-30.6-24.5-55.3-54.6-55.3z"
                    fill="currentColor"
                  ></path>
                </svg>
              </NIcon>
            </template>
          </NButton>
        </RouterLink>
      </NSpace>
    </div>
    <NDataTable
      striped
      :data="filterSnapshots"
      :columns="columns"
      :scrollX="1800"
      :pagination="pagination"
      v-model:checkedRowKeys="checkedRowKeys"
      :rowKey="(r:Snapshot)=>r.id"
      @update:sorter="handleSorterChange"
      size="small"
      class="flex-1"
      flexHeight
    />
  </div>
</template>
