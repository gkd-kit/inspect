<script setup lang="tsx">
import { useDeviceApi } from '@/utils/api';
import { toValidURL } from '@/utils/check';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { delay } from '@/utils/others';
import { checkSelector } from '@/utils/selector';
import { snapshotStorage, screenshotStorage } from '@/utils/storage';
import { useSnapshotColumns } from '@/utils/table';
import { useBatchTask, useTask } from '@/utils/task';
import type { Device, Snapshot } from '@/utils/types';
import { useStorage, useTitle, useDebounceFn } from '@vueuse/core';
import JSON5 from 'json5';
import {
  DataTableColumns,
  NButton,
  NDataTable,
  NInput,
  NInputGroup,
  NSpace,
  PaginationProps,
  NIcon,
  NModal,
  NRadioGroup,
  NRadio,
  NSelect,
  NCheckbox,
} from 'naive-ui';
import { SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';
import {
  onMounted,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
  watchEffect,
} from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const title = useTitle(`新设备`);
const { api, origin } = useDeviceApi();
const link = useStorage(`device_link`, ``);
const device = shallowRef<Device>();
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

const snapshots = shallowRef<Snapshot[]>([]);
watchEffect(async () => {
  if (!device.value) return;
  title.value = `已连接 ` + device.value.manufacturer;
  const result = await api.snapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
  const subsApps = await api.subsApps();
  subsText.value = JSON5.stringify(
    subsApps || [],
    function (key, value) {
      if (value === null) return undefined;
      return value;
    },
    2,
  );
});

const captureSnapshot = useTask(async () => {
  const snapshot = await api.captureSnapshot();
  const screenshot = await api.screenshot({ id: snapshot.id });
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, screenshot);
  message.success(`保存快照成功`);
  const result = await api.snapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
});
const downloadAllSnapshot = useTask(async () => {
  const snapshotIds = (await api.snapshots()).map((s) => s.id);
  const existSnapshotIds = new Set(
    (await screenshotStorage.keys()).map((s) => parseInt(s)),
  );
  const unimportSnapshotIds = snapshotIds.filter(
    (k) => !existSnapshotIds.has(k),
  );
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
          snapshotStorage.setItem(snapshotId, newSnapshot),
          screenshotStorage.setItem(snapshotId, newScreenshot),
        ]);
        r++;
      }),
    ),
  );
  message.success(`导入${r}条新记录`);
});

const {
  activityIdCol,
  appIdCol,
  appNameCol,
  ctimeCol,
  appVersionCodeCol,
  appVersionNameCol,
  reseColWidth,
} = useSnapshotColumns();
const handleSorterChange = (sorter: SortState) => {
  if (sorter.columnKey == ctimeCol.key) {
    ctimeCol.sortOrder = sorter.order;
  }
};
const previewSnapshot = useBatchTask(
  async (row: Snapshot) => {
    if (!(await snapshotStorage.hasItem(row.id))) {
      await snapshotStorage.setItem(row.id, await api.snapshot({ id: row.id }));
    }
    if (!(await screenshotStorage.hasItem(row.id))) {
      const bf = await api.screenshot({ id: row.id });
      await screenshotStorage.setItem(row.id, bf);
    }
    window.open(
      router.resolve({
        name: 'snapshot',
        params: { snapshotId: row.id },
      }).href,
    );
  },
  (r) => r.id,
);

const columns: DataTableColumns<Snapshot> = [
  ctimeCol,
  appNameCol,
  appIdCol,
  appVersionCodeCol,
  appVersionNameCol,
  activityIdCol,
  {
    key: `actions`,
    title: `Action`,
    fixed: 'right',
    width: `120px`,
    render(row) {
      return (
        <NSpace size="small">
          <NButton
            size="small"
            loading={previewSnapshot.loading[row.id]}
            onClick={() => previewSnapshot.invoke(row)}
          >
            查看
          </NButton>
        </NSpace>
      );
    },
  },
];

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

const showSubsModel = shallowRef(false);
const subsText = shallowRef(``);
const updateSubs = useTask(async () => {
  const appsSubs = errorWrap(() => JSON5.parse(subsText.value.trim() || `[]`));
  await api.updateSubsApps([].concat(appsSubs));
  message.success(`修改成功`);
});

const showSelectorModel = shallowRef(false);

const actionOptions = [
  'click',
  'clickNode',
  'clickCenter',
  'back',
  'longClick',
  'longClickNode',
  'longClickCenter',
].map((s) => ({ value: s, label: s }));
const clickAction = shallowReactive({
  selector: ``,
  selectorValid: false,
  action: actionOptions[0].value,
  quickFind: false,
});
const checkSelectorValid = useDebounceFn(() => {
  clickAction.selectorValid = checkSelector(clickAction.selector);
}, 500);
watch(() => clickAction.selector.trim(), checkSelectorValid);
const execSelector = useTask(async () => {
  const result = await api.execSelector({ ...clickAction });
  if (result.message) {
    message.success(`点击成功:` + result.message);
    return;
  }
  if (result.action) {
    message.success((result.result ? `点击成功:` : `点击失败`) + result.action);
  }
});
</script>
<template>
  <NModal
    v-model:show="showSubsModel"
    preset="dialog"
    style="width: 800px"
    title="修改内存订阅"
    positive-text="确认"
    :positiveButtonProps="{
      loading: updateSubs.loading,
      onClick() {
        updateSubs.invoke();
      },
    }"
  >
    <NInput
      v-model:value="subsText"
      :disabled="updateSubs.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{
        minRows: 10,
        maxRows: 25,
      }"
      :placeholder="`请输入订阅文本\n订阅支持JSON5\n根节点可以是APP规则对象也可以是APP规则对象数组`"
    />
  </NModal>
  <NModal
    v-model:show="showSelectorModel"
    preset="dialog"
    style="width: 800px"
    title="执行选择器"
    positive-text="确认"
    :positiveButtonProps="{
      loading: execSelector.loading,
      disabled: !clickAction.selectorValid,
      onClick() {
        execSelector.invoke();
      },
    }"
  >
    <NInput
      v-model:value="clickAction.selector"
      :disabled="execSelector.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{
        minRows: 4,
        maxRows: 10,
      }"
      placeholder="请输入合法的选择器"
    />
    <div h-15px></div>
    <NSpace>
      <NCheckbox v-model:checked="clickAction.quickFind"> 快速查找 </NCheckbox>
      <a
        href="https://github.com/gkd-kit/subscription/blob/main/src/types.ts"
        target="_blank"
        rel="noopener noreferrer"
      >
        查找说明
      </a>
    </NSpace>
    <div h-10px></div>
    <div flex gap-10px flex-items-center>
      <NSelect
        v-model:value="clickAction.action"
        :options="actionOptions"
        class="w-150px"
      />
      <a
        href="https://github.com/gkd-kit/subscription/blob/main/src/types.ts"
        target="_blank"
        rel="noopener noreferrer"
      >
        操作说明
      </a>
    </div>
  </NModal>
  <div flex flex-col p-10px gap-10px h-full>
    <NSpace>
      <RouterLink to="/">
        <NButton>
          <template #icon>
            <NIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 32 32"
              >
                <path
                  d="M16.612 2.214a1.01 1.01 0 0 0-1.242 0L1 13.419l1.243 1.572L4 13.621V26a2.004 2.004 0 0 0 2 2h20a2.004 2.004 0 0 0 2-2V13.63L29.757 15L31 13.428zM18 26h-4v-8h4zm2 0v-8a2.002 2.002 0 0 0-2-2h-4a2.002 2.002 0 0 0-2 2v8H6V12.062l10-7.79l10 7.8V26z"
                  fill="currentColor"
                ></path>
              </svg>
            </NIcon>
          </template>
        </NButton>
      </RouterLink>
      <NInputGroup>
        <NInput
          v-model:value="link"
          placeholder="请输入设备地址"
          :style="{ minWidth: `250px` }"
          @keyup.enter="connect.invoke"
        ></NInput>
        <NButton @click="connect.invoke" :loading="connect.loading">
          刷新连接
        </NButton>
      </NInputGroup>
      <template v-if="device">
        <div class="h-full" flex flex-items-center>
          {{ `已连接 ${device.manufacturer} Android ${device.release}` }}
        </div>
        <NButton
          @click="captureSnapshot.invoke"
          :loading="captureSnapshot.loading"
        >
          快照
        </NButton>
        <NButton
          @click="downloadAllSnapshot.invoke"
          :loading="downloadAllSnapshot.loading"
        >
          下载设备所有快照
        </NButton>
        <NButton @click="showSubsModel = true"> 修改内存订阅 </NButton>
        <NButton @click="showSelectorModel = true"> 执行选择器 </NButton>
      </template>
    </NSpace>
    <NDataTable
      striped
      flexHeight
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      @update:sorter="handleSorterChange"
      size="small"
      class="flex-1"
      :scrollX="1200"
    />
  </div>
</template>
