<script setup lang="tsx">
import { useDeviceApi } from '@/utils/api';
import { toValidURL } from '@/utils/check';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { delay } from '@/utils/others';
import { screenshotStorage, snapshotStorage } from '@/utils/snapshot';
import { useSnapshotColumns } from '@/utils/table';
import { useBatchTask, useTask } from '@/utils/task';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { SortState } from 'naive-ui/es/data-table/src/interface';
import pLimit from 'p-limit';
import JSON5 from 'json5';
import ActionCard from '@/components/ActionCard.vue';
import BatchActionsBar from '@/components/BatchActionsBar.vue';
import { useBatchActions } from '@/composables/useBatchActions';

const router = useRouter();
const { api, origin, serverInfo } = useDeviceApi();
const link = shallowRef(localStorage.getItem(`device_link`) || ``);
const subsText = shallowRef(``);
const snapshots = shallowRef<Snapshot[]>([]);
const updateLink = (value: string) => {
  link.value = value;
};
const loadSnapshots = async () => {
  const result = await api.getSnapshots();
  result.sort((a, b) => b.id - a.id);
  snapshots.value = result;
};
const connect = useTask(async () => {
  if (!link.value) return;
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  localStorage.setItem(`device_link`, link.value);
  serverInfo.value = await api.getServerInfo();
  document.title = serverTitle.value;
  await loadSnapshots();
  subsText.value = ``;
});

const serverTitle = computed(() => {
  if (!serverInfo.value) return '未连接设备';
  const d = serverInfo.value.device;
  const g = serverInfo.value.gkdAppInfo;
  return `${d.manufacturer} Android${d.release} - GKD${g.versionName}`;
});

onMounted(async () => {
  await delay(500);
  if (toValidURL(link.value)) {
    connect.invoke();
  }
});

const captureSnapshot = useTask(async () => {
  const snapshot = await api.captureSnapshot();
  const screenshot = await api.getScreenshot({ id: snapshot.id });
  await snapshotStorage.setItem(snapshot.id, snapshot);
  await screenshotStorage.setItem(snapshot.id, screenshot);
  message.success(`捕获并保存快照成功`);
  await loadSnapshots();
});
const downloadAllSnapshot = useTask(async () => {
  const snapshotIds = (await api.getSnapshots()).map((s) => s.id);
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
          api.getSnapshot({ id: snapshotId }),
          api.getScreenshot({ id: snapshotId }),
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
      const obj = await api.getSnapshot({ id: row.id });
      await snapshotStorage.setItem(row.id, obj);
    }
    if (!(await screenshotStorage.hasItem(row.id))) {
      const bf = await api.getScreenshot({ id: row.id });
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
  {
    type: 'selection',
  },
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
    width: `160px`,
    render(row) {
      return (
        <ActionCard
          snapshot={row}
          showExport={false}
          showShare={false}
          deleteConfirmText={`是否确认删除? 此操作不可恢复!\n快照ID:${row.id}`}
          onPreview={() => previewSnapshot.invoke(row)}
          previewLoading={previewSnapshot.loading[row.id]}
          onBeforeDelete={async () => await api.deleteSnapshot({ id: row.id })}
          onDelete={() => {
            snapshots.value = snapshots.value.filter((s) => s.id !== row.id);
          }}
        />
      );
    },
  },
];

const checkedRowKeys = ref<number[]>([]);
const { batchDelete } = useBatchActions(checkedRowKeys, {
  beforeDeleteItem: async (id) => await api.deleteSnapshot({ id }),
  onAfterDelete: async () => {
    await loadSnapshots();
  },
});

const pagination = shallowReactive<PaginationProps>({
  page: 1,
  pageSize: 50,
  showSizePicker: true,
  pageSizes: [50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    resetColWidth();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    resetColWidth();
  },
});

const showSubsModel = shallowRef(false);
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
    value: ``,
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
    positiveText="确认"
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
    positiveText="确认"
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
    <div h-15px />
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
    <div h-10px />
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
  <div page-size flex flex-col p-10px gap-10px>
    <div flex items-center gap-24px>
      <RouterLink to="/" class="flex ml-12px" title="首页">
        <NButton text style="--n-icon-size: 24px">
          <template #icon>
            <SvgIcon name="home" />
          </template>
        </NButton>
      </RouterLink>
      <NInputGroup>
        <NInput
          :value="link"
          placeholder="请输入设备地址"
          class="gkd_code"
          :style="{ width: `240px` }"
          @keyup.enter="connect.invoke"
          @update:value="updateLink"
        >
          <template #suffix>
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  style="--n-icon-size: 20px"
                  :loading="connect.loading"
                  @click="connect.invoke"
                >
                  <template #icon><SvgIcon name="refresh" /></template>
                </NButton>
              </template>
              刷新连接
            </NTooltip>
          </template>
        </NInput>

        <div
          v-if="serverInfo"
          gkd_code
          pl-16px
          whitespace-nowrap
          flex
          items-center
        >
          {{ serverTitle }}
        </div>
      </NInputGroup>
      <template v-if="serverInfo">
        <BatchActionsBar
          :checkedCount="checkedRowKeys.length"
          :batchDelete="batchDelete"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="captureSnapshot.loading"
              @click="captureSnapshot.invoke"
            >
              <template #icon><SvgIcon name="Snapshot" /></template>
            </NButton>
          </template>
          捕获快照
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              :loading="downloadAllSnapshot.loading"
              @click="downloadAllSnapshot.invoke"
            >
              <template #icon><SvgIcon name="Down-all" /></template>
            </NButton>
          </template>
          下载所有快照
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              @click="showSubsModel = true"
            >
              <template #icon><SvgIcon name="CacheSub" /></template>
            </NButton>
          </template>
          修改内存订阅
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              style="--n-icon-size: 24px"
              @click="showSelectorModel = true"
            >
              <template #icon><SvgIcon name="Exe-Sel" /></template>
            </NButton>
          </template>
          执行选择器
        </NTooltip>
      </template>
    </div>
    <NDataTable
      v-model:checkedRowKeys="checkedRowKeys"
      striped
      flex-height
      :data="snapshots"
      :columns="columns"
      :pagination="pagination"
      :rowKey="(r:Snapshot)=>r.id"
      size="small"
      class="flex-1"
      :scrollX="1200"
      @update:sorter="handleSorterChange"
    />
  </div>
</template>
