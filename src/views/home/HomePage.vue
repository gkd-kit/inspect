<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { toValidURL } from '@/utils/check';
import { showTextDLg, waitShareAgree } from '@/utils/dialog';
import { dialog } from '@/utils/discrete';
import {
  batchCreateImageId,
  batchCreateZipUrl,
  batchJpgDownloadZip,
  batchZipDownloadZip,
} from '@/utils/export';
import { importFromLocal, importFromNetwork } from '@/utils/import';
import { getAppInfo } from '@/utils/node';
import { shallowSnapshotStorage, snapshotStorage } from '@/utils/snapshot';
import { renderDevice, useSnapshotColumns } from '@/utils/table';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import { getImagUrl } from '@/utils/url';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { SortState } from 'naive-ui/es/data-table/src/interface';
import BuildShareDlg from './BuildShareDlg.vue';

const settingsStore = useSettingsStore();

const snapshots = shallowRef<Snapshot[]>([]);
const loading = shallowRef(true);
const updateSnapshots = async () => {
  loading.value = true;
  snapshots.value = (await shallowSnapshotStorage.getAllItems()).reverse();
  checkedRowKeys.value = [];
  loading.value = false;
};
onMounted(updateSnapshots);
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
      (getAppInfo(s).name || ``).includes(actualQuery) ||
      (s.appId || ``).includes(actualQuery) ||
      (s.activityId || ``).includes(actualQuery)
    );
  });
});

const importLocal = useTask(async () => {
  await importFromLocal();
  await updateSnapshots();
});

const {
  activityIdCol,
  appIdCol,
  appNameCol,
  ctimeCol,
  mtimeCol,
  deviceCol,
  appVersionCodeCol,
  appVersionNameCol,
  resetColWidth,
} = useSnapshotColumns();

watchEffect(() => {
  const set = filterSnapshots.value.reduce(
    (p, c) => (p.add(renderDevice(c)), p),
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
    (p, c) => (p.add(getAppInfo(c).name), p),
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
  mtimeCol,
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
    width: `160px`,
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
watch(pagination, resetColWidth);

const handleSorterChange = (sorter: SortState) => {
  [ctimeCol, mtimeCol].forEach((c) => {
    if (sorter.columnKey != c.key) {
      c.sortOrder = undefined;
    } else {
      c.sortOrder = sorter.order;
    }
  });
};
mtimeCol.sortOrder = `descend`;
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
  await waitShareAgree();
  const imageIds = await batchCreateImageId(await checkedSnapshots());
  showTextDLg({
    content: imageIds.map((s) => getImagUrl(s)).join(`\n`) + `\n`,
  });
});
const batchShareZipUrl = useTask(async () => {
  await waitShareAgree();
  const zipUrls = await batchCreateZipUrl(await checkedSnapshots());
  showTextDLg({
    content: zipUrls.map((s) => location.origin + '/i/' + s).join(`\n`) + `\n`,
  });
});

const shareDlgShow = shallowRef(false);
const settingsDlgShow = shallowRef(false);
</script>
<template>
  <div flex flex-col p-10px gap-10px h-full>
    <div flex>
      <NSpace>
        <NInputGroup>
          <NInput
            placeholder="请输入应用名称/应用ID/界面ID"
            clearable
            class="min-w-320px"
            v-model:value="filterOption.query"
            @keyup.enter="filterOption.updateQuery"
            @change="filterOption.updateQuery"
          ></NInput>
          <NButton @click="filterOption.updateQuery">
            <template #icon>
              <NIcon>
                <svg viewBox="0 0 32 32">
                  <path
                    d="M29 27.586l-7.552-7.552a11.018 11.018 0 1 0-1.414 1.414L27.586 29zM4 13a9 9 0 1 1 9 9a9.01 9.01 0 0 1-9-9z"
                    fill="currentColor"
                  ></path>
                </svg>
              </NIcon>
            </template>
          </NButton>
        </NInputGroup>
        <template v-if="checkedRowKeys.length">
          <NPopover>
            <template #trigger>
              <NButton> 批量下载 </NButton>
            </template>
            <NSpace vertical>
              <NButton
                @click="batchDownloadZip.invoke"
                :loading="batchDownloadZip.loading"
              >
                批量下载-快照
              </NButton>
              <NButton
                @click="batchDownloadJpg.invoke"
                :loading="batchDownloadJpg.loading"
              >
                批量下载-图片
              </NButton>
            </NSpace>
          </NPopover>
          <NPopover>
            <template #trigger>
              <NButton> 批量分享 </NButton>
            </template>
            <NSpace vertical>
              <NButton
                @click="batchShareZipUrl.invoke"
                :loading="batchShareZipUrl.loading"
              >
                批量生成链接-快照
              </NButton>
              <NButton
                @click="batchShareJpgUrl.invoke"
                :loading="batchShareJpgUrl.loading"
              >
                批量生成链接-图片
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
      <div flex gap-24px items-center pr-8px>
        <NButton text title="设置" @click="settingsDlgShow = true">
          <template #icon>
            <NIcon :size="24">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19.43 12.98c.04-.32.07-.64.07-.98c0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.566.566 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98c0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73c0 .21-.02.43-.05.73l-.14 1.13l.89.7l1.08.84l-.7 1.21l-1.27-.51l-1.04-.42l-.9.68c-.43.32-.84.56-1.25.73l-1.06.43l-.16 1.13l-.2 1.35h-1.4l-.19-1.35l-.16-1.13l-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7l-1.06.43l-1.27.51l-.7-1.21l1.08-.84l.89-.7l-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13l-.89-.7l-1.08-.84l.7-1.21l1.27.51l1.04.42l.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43l.16-1.13l.2-1.35h1.39l.19 1.35l.16 1.13l1.06.43c.43.18.83.41 1.23.71l.91.7l1.06-.43l1.27-.51l.7 1.21l-1.07.85l-.89.7l.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"
                  fill="currentColor"
                ></path>
              </svg>
            </NIcon>
          </template>
        </NButton>
        <NPopover>
          <template #trigger>
            <NButton text>
              <template #icon>
                <NIcon :size="24">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
                    <path
                      fill="currentColor"
                      d="M28 19H14.83l2.58-2.59L16 15l-5 5l5 5l1.41-1.41L14.83 21H28z"
                    />
                    <path
                      fill="currentColor"
                      d="M24 14v-4a1 1 0 0 0-.29-.71l-7-7A1 1 0 0 0 16 2H6a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2h-2v2H6V4h8v6a2 2 0 0 0 2 2h6v2Zm-8-4V4.41L21.59 10Z"
                    />
                  </svg>
                </NIcon>
              </template>
            </NButton>
          </template>
          <NSpace vertical>
            <NButton @click="importLocal.invoke" :loading="importLocal.loading">
              导入本地文件
            </NButton>
            <NButton @click="showModal = true" :loading="importNetwork.loading">
              导入网络文件
            </NButton>
          </NSpace>
        </NPopover>
        <a flex href="/device" title="连接设备">
          <NButton text>
            <template #icon>
              <NIcon :size="24">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M18.35 14.85L16.9 13.4q.3-.275.463-.637t.162-.763t-.162-.763t-.463-.637l1.45-1.45q.575.575.875 1.313t.3 1.537t-.3 1.538t-.875 1.312m2.45 2.45l-1.4-1.4q.775-.775 1.2-1.775T21.025 12T20.6 9.875T19.4 8.1l1.4-1.4q1.075 1.05 1.65 2.425T23.025 12t-.575 2.875T20.8 17.3M7 23q-.825 0-1.412-.587T5 21V3q0-.825.588-1.412T7 1h10q.825 0 1.413.588T19 3v4h-2V6H7v12h10v-1h2v4q0 .825-.587 1.413T17 23zm0-3v1h10v-1zM7 4h10V3H7zm0 0V3zm0 16v1z"
                  />
                </svg>
              </NIcon>
            </template>
          </NButton>
        </a>
        <a
          flex
          href="https://github.com/gkd-kit/inspect"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NButton text>
            <template #icon>
              <NIcon :size="24">
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
      </div>
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
      :loading="loading"
    />
  </div>
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
    @afterLeave="text = ``"
  >
    <NInput
      :value="text"
      @update:value="
        if (!importNetwork.loading) {
          text = $event;
        }
      "
      type="textarea"
      :placeholder="`1.支持ZIP文件链接\n2.支持快照链接\n每行一个\n空白行自动忽略\n非法链接行自动忽略`"
      :autosize="{
        minRows: 8,
        maxRows: 16,
      }"
      :inputProps="{
        style: `white-space: nowrap;`,
      }"
    />
  </NModal>
  <BuildShareDlg v-model:show="shareDlgShow" />

  <NModal
    v-model:show="settingsDlgShow"
    preset="dialog"
    title="设置"
    :showIcon="false"
    positiveText="关闭"
    style="width: 600px"
    @positiveClick="settingsDlgShow = false"
  >
    <NCheckbox v-model:checked="settingsStore.ignoreUploadWarn">
      关闭生成分享链接弹窗提醒
    </NCheckbox>
    <div h-1px my-10px bg="#eee"></div>
    <NCheckbox v-model:checked="settingsStore.ignoreWasmWarn">
      关闭浏览器版本正则表达式 WASM(GC) 提醒
    </NCheckbox>
    <div h-1px my-10px bg="#eee"></div>
    <div flex gap-10px>
      <NSwitch v-model:value="settingsStore.autoUploadImport" />
      <div>打开快照页面自动生成分享链接(请确保不含隐私)</div>
    </div>
  </NModal>
</template>
