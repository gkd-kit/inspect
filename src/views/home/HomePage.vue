<script lang="tsx" setup>
import ActionCard from '@/components/ActionCard.vue';
import { toValidURL } from '@/utils/check';
import { showTextDLg, waitShareAgree } from '@/utils/dialog';
import { dialog } from '@/utils/discrete';
import {
  batchCreateImageId,
  batchCreateZipUrl,
  batchImageDownloadZip,
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
const batchDownloadImage = useTask(async () => {
  await batchImageDownloadZip(await checkedSnapshots());
});
const batchDownloadZip = useTask(async () => {
  await batchZipDownloadZip(await checkedSnapshots());
});

const batchShareImageUrl = useTask(async () => {
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
                @click="batchDownloadImage.invoke"
                :loading="batchDownloadImage.loading"
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
                @click="batchShareImageUrl.invoke"
                :loading="batchShareImageUrl.loading"
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">
                  <path
                    d="M12 8.25a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5M9.75 12a2.25 2.25 0 1 1 4.5 0a2.25 2.25 0 0 1-4.5 0"
                  />
                  <path
                    d="M11.975 1.25c-.445 0-.816 0-1.12.02a2.8 2.8 0 0 0-.907.19a2.75 2.75 0 0 0-1.489 1.488c-.145.35-.184.72-.2 1.122a.87.87 0 0 1-.415.731a.87.87 0 0 1-.841-.005c-.356-.188-.696-.339-1.072-.389a2.75 2.75 0 0 0-2.033.545a2.8 2.8 0 0 0-.617.691c-.17.254-.356.575-.578.96l-.025.044c-.223.385-.408.706-.542.98c-.14.286-.25.568-.29.88a2.75 2.75 0 0 0 .544 2.033c.231.301.532.52.872.734a.87.87 0 0 1 .426.726a.87.87 0 0 1-.426.726c-.34.214-.64.433-.872.734a2.75 2.75 0 0 0-.545 2.033c.041.312.15.594.29.88c.135.274.32.595.543.98l.025.044c.222.385.408.706.578.96c.177.263.367.5.617.69a2.75 2.75 0 0 0 2.033.546c.376-.05.716-.2 1.072-.389a.87.87 0 0 1 .84-.005a.86.86 0 0 1 .417.731c.015.402.054.772.2 1.122a2.75 2.75 0 0 0 1.488 1.489c.29.12.59.167.907.188c.304.021.675.021 1.12.021h.05c.445 0 .816 0 1.12-.02c.318-.022.617-.069.907-.19a2.75 2.75 0 0 0 1.489-1.488c.145-.35.184-.72.2-1.122a.87.87 0 0 1 .415-.732a.87.87 0 0 1 .841.006c.356.188.696.339 1.072.388a2.75 2.75 0 0 0 2.033-.544c.25-.192.44-.428.617-.691c.17-.254.356-.575.578-.96l.025-.044c.223-.385.408-.706.542-.98c.14-.286.25-.569.29-.88a2.75 2.75 0 0 0-.544-2.033c-.231-.301-.532-.52-.872-.734a.87.87 0 0 1-.426-.726c0-.278.152-.554.426-.726c.34-.214.64-.433.872-.734a2.75 2.75 0 0 0 .545-2.033a2.8 2.8 0 0 0-.29-.88a18 18 0 0 0-.543-.98l-.025-.044a18 18 0 0 0-.578-.96a2.8 2.8 0 0 0-.617-.69a2.75 2.75 0 0 0-2.033-.546c-.376.05-.716.2-1.072.389a.87.87 0 0 1-.84.005a.87.87 0 0 1-.417-.731c-.015-.402-.054-.772-.2-1.122a2.75 2.75 0 0 0-1.488-1.489c-.29-.12-.59-.167-.907-.188c-.304-.021-.675-.021-1.12-.021zm-1.453 1.595c.077-.032.194-.061.435-.078c.247-.017.567-.017 1.043-.017s.796 0 1.043.017c.241.017.358.046.435.078c.307.127.55.37.677.677c.04.096.073.247.086.604c.03.792.439 1.555 1.165 1.974s1.591.392 2.292.022c.316-.167.463-.214.567-.227a1.25 1.25 0 0 1 .924.247c.066.051.15.138.285.338c.139.206.299.483.537.895s.397.69.506.912c.107.217.14.333.15.416a1.25 1.25 0 0 1-.247.924c-.064.083-.178.187-.48.377c-.672.422-1.128 1.158-1.128 1.996s.456 1.574 1.128 1.996c.302.19.416.294.48.377c.202.263.29.595.247.924c-.01.083-.044.2-.15.416c-.109.223-.268.5-.506.912s-.399.689-.537.895c-.135.2-.219.287-.285.338a1.25 1.25 0 0 1-.924.247c-.104-.013-.25-.06-.567-.227c-.7-.37-1.566-.398-2.292.021s-1.135 1.183-1.165 1.975c-.013.357-.046.508-.086.604a1.25 1.25 0 0 1-.677.677c-.077.032-.194.061-.435.078c-.247.017-.567.017-1.043.017s-.796 0-1.043-.017c-.241-.017-.358-.046-.435-.078a1.25 1.25 0 0 1-.677-.677c-.04-.096-.073-.247-.086-.604c-.03-.792-.439-1.555-1.165-1.974s-1.591-.392-2.292-.022c-.316.167-.463.214-.567.227a1.25 1.25 0 0 1-.924-.247c-.066-.051-.15-.138-.285-.338a17 17 0 0 1-.537-.895c-.238-.412-.397-.69-.506-.912c-.107-.217-.14-.333-.15-.416a1.25 1.25 0 0 1 .247-.924c.064-.083.178-.187.48-.377c.672-.422 1.128-1.158 1.128-1.996s-.456-1.574-1.128-1.996c-.302-.19-.416-.294-.48-.377a1.25 1.25 0 0 1-.247-.924c.01-.083.044-.2.15-.416c.109-.223.268-.5.506-.912s.399-.689.537-.895c.135-.2.219-.287.285-.338a1.25 1.25 0 0 1 .924-.247c.104.013.25.06.567.227c.7.37 1.566.398 2.292-.022c.726-.419 1.135-1.182 1.165-1.974c.013-.357.046-.508.086-.604c.127-.307.37-.55.677-.677"
                  />
                </g>
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
        <RouterLink flex to="/device" title="连接设备">
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
        </RouterLink>
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
