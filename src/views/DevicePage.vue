<script setup lang="tsx">
import { useDeviceApi } from '@/utils/api';
import { toValidURL } from '@/utils/check';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { delay } from '@/utils/others';
import { screenshotStorage, snapshotStorage } from '@/utils/snapshot';
import { useSnapshotColumns } from '@/utils/table';
import { useBatchTask, useTask } from '@/utils/task';
import type { Device, Snapshot } from '@/utils/types';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';

const router = useRouter();
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
  document.title = `已连接 ` + device.value.manufacturer;
  const result = await api.snapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
  subsText.value = '';
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
  resetColWidth,
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
    title: `操作`,
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
watch(pagination, resetColWidth);

const showSubsModel = shallowRef(false);
const subsText = shallowRef(``);
const updateSubs = useTask(async () => {
  const data = errorWrap(() => JSON5.parse(subsText.value.trim()));
  if (!data) return;
  if (data.categories || data.globalGroups || data.apps) {
    await api.updateSubscription(data);
  } else if (typeof data.id == 'string') {
    await api.updateSubscription({
      apps: [data],
    });
  } else if (Array.isArray(data) && typeof data[0].id == 'string') {
    await api.updateSubscription({
      apps: data,
    });
  } else if (typeof data.key == 'number') {
    await api.updateSubscription({
      globalGroups: [data],
    });
  } else if (Array.isArray(data) && typeof data[0].key == 'number') {
    await api.updateSubscription({
      globalGroups: data,
    });
  } else {
    message.error(`无法识别的订阅文本`);
    return;
  }
  message.success(`修改成功`);
});

const showSelectorModel = shallowRef(false);

const actionOptions: {
  value?: string;
  label: string;
}[] = [
  {
    label: '仅查询',
    value: undefined,
  },
  {
    value: 'click',
    label: 'click',
  },
  {
    value: 'clickNode',
    label: 'clickNode',
  },
  {
    value: 'clickCenter',
    label: 'clickCenter',
  },
  {
    value: 'back',
    label: 'back',
  },
  {
    value: 'longClick',
    label: 'longClick',
  },
  {
    value: 'longClickNode',
    label: 'longClickNode',
  },
  {
    value: 'longClickCenter',
    label: 'longClickCenter',
  },
];
const clickAction = shallowReactive({
  selector: ``,
  action: 'click',
  quickFind: false,
});
const execSelector = useTask(async () => {
  const result = await api.execSelector({
    ...clickAction,
    fastQuery: clickAction.quickFind,
  });
  if (result.message) {
    message.success(`操作成功:` + result.message);
    return;
  }
  if (result.action) {
    message.success((result.result ? `操作成功:` : `操作失败`) + result.action);
  } else if (!result.action && result.result) {
    message.success(`查询成功`);
  }
});

const placeholder = `
请输入订阅文本(JSON5语法):
示例1-更新单个应用的规则:
{
  id: 'appId',
  groups: []
}

示例2-更新多个应用的规则:
[
  {
    id: 'appId1',
    groups: []
  },
  {
    id: 'appId2',
    groups: []
  }
]

示例3-更新全局规则(1.7.0):
{
  name: '全局规则-1',
  key: 0,
  rules: []
}

示例3-更新多个全局规则(1.7.0):
[
  {
    name: '全局规则-1',
    key: 0,
    rules: []
  },
  {
    name: '全局规则-2',
    key: 1,
    rules: []
  }
]

示例4-更新整个订阅(1.7.0):
{
  apps: [],
  globalGroups: [],
  categories: [],
}
`.trim();
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
        minRows: 20,
        maxRows: 25,
      }"
      :placeholder="placeholder"
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
        href="https://gkd.li/api/interfaces/RawCommonProps.html#quickfind"
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
        href="https://gkd.li/api/interfaces/RawRuleProps#action"
        target="_blank"
        rel="noopener noreferrer"
      >
        操作说明
      </a>
    </div>
  </NModal>
  <div flex flex-col p-10px gap-10px h-full>
    <div flex items-center gap-24px>
      <RouterLink to="/" flex ml-12px title="首页">
        <NButton text style="--n-icon-size: 24px">
          <template #icon>
            <SvgIcon name="home" />
          </template>
        </NButton>
      </RouterLink>
      <NInputGroup>
        <NInput
          v-model:value="link"
          placeholder="请输入设备地址"
          :style="{ width: `200px` }"
          @keyup.enter="connect.invoke"
        ></NInput>
        <NButton @click="connect.invoke" :loading="connect.loading">
          刷新连接
        </NButton>
      </NInputGroup>
      <template v-if="device">
        <div whitespace-nowrap>
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
    </div>
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
