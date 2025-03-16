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
              <SvgIcon name="search" />
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
      <div flex gap-24px items-center pr-8px class="[--svg-h:24px]">
        <NTooltip>
          <template #trigger>
            <NButton text @click="settingsDlgShow = true">
              <SvgIcon name="settings" />
            </NButton>
          </template>
          设置
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <RouterLink flex to="/selector">
              <NButton text>
                <SvgIcon name="terminal" />
              </NButton>
            </RouterLink>
          </template>
          测试选择器
        </NTooltip>
        <NPopover>
          <template #trigger>
            <NButton text>
              <SvgIcon name="import" />
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
        <NTooltip>
          <template #trigger>
            <RouterLink flex to="/device">
              <NButton text>
                <SvgIcon name="device" />
              </NButton>
            </RouterLink>
          </template>
          连接设备
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <a
              flex
              href="https://github.com/orgs/gkd-kit/discussions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <SvgIcon name="discussion" />
              </NButton>
            </a>
          </template>
          讨论交流
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <a
              flex
              href="https://github.com/gkd-kit/inspect"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <SvgIcon name="github" />
              </NButton>
            </a>
          </template>
          Github
        </NTooltip>
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
