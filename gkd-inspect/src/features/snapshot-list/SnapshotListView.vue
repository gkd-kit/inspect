<script lang="tsx" setup>
import {
  NButton,
  NButtonGroup,
  NDataTable,
  NInput,
  NInputGroup,
  NModal,
  NPopover,
  NSpace,
  NTooltip,
} from 'naive-ui';
import { RouterLink } from 'vue-router';
import {
  computed,
  onMounted,
  reactive,
  ref,
  shallowReactive,
  shallowRef,
} from 'vue';
import { useEventListener } from '@vueuse/core';

import type { Snapshot } from '@/entities/snapshot/types';

import GkSvg from '@/shared/ui/GkSvg.vue';
import SnapshotActionCard from '@/features/snapshot-management/ui/SnapshotActionCard.vue';
import SnapshotBatchActionsBar from '@/features/snapshot-management/ui/SnapshotBatchActionsBar.vue';
import SettingsModal from '@/features/settings/SettingsModal.vue';
import { toValidURL } from '@/shared/lib/check';
import {
  importFromLocal,
  importFromNetwork,
} from '@/features/snapshot-management/import';
import { getAppInfo } from '@/entities/snapshot/node';
import { getDragEventFiles } from '@/shared/lib/files';
import { shallowSnapshotStorage } from '@/entities/snapshot/storage';
import {
  renderDevice,
  useSnapshotColumns,
} from '@/entities/snapshot/ui/useSnapshotColumns';
import { useLatestTask } from '@/shared/lib/latest_task';
import { useSingleTask } from '@/shared/lib/latest_task';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import type { SortState } from 'naive-ui/es/data-table/src/interface';
import { useBatchActions } from '@/features/snapshot-management/useBatchActions';
import SnapshotGroupView from './SnapshotGroupView.vue';

const snapshots = shallowRef<Snapshot[]>([]);
const snapshotsTask = useLatestTask(
  async ({ commit }, afterApply?: () => void) => {
    const result = (await shallowSnapshotStorage.getAllItems()).reverse();
    commit(() => {
      snapshots.value = result;
      checkedRowKeys.value = [];
      updateColumnFilterOptions();
      afterApply?.();
    });
  },
);
const loading = snapshotsTask.loading;
const updateSnapshots = async () => {
  await snapshotsTask.run();
};
onMounted(updateSnapshots);
const filterOption = shallowReactive({
  query: ``,
  actualQuery: ``,
  updateQuery: () => {
    const query = filterOption.query.trim();
    if (query == filterOption.actualQuery) return;
    filterOption.actualQuery = query;
    checkedRowKeys.value = [];
    updateColumnFilterOptions();
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

const importLocal = useSingleTask(async (_context, _files?: File[]) => {
  if (await importFromLocal(_files)) {
    await updateSnapshots();
  }
});

useEventListener(document.body, 'drop', async (e) => {
  e.preventDefault();
  await importLocal.run(getDragEventFiles(e));
});
useEventListener(document.body, 'dragover', (e) => {
  e.preventDefault();
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

const toFilterOptions = (values: Iterable<string>) => {
  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length <= 1) return undefined;
  return uniqueValues.map((value) => ({ value, label: value }));
};
function updateColumnFilterOptions() {
  const currentSnapshots = filterSnapshots.value;
  deviceCol.filterOptions = toFilterOptions(currentSnapshots.map(renderDevice));
  appNameCol.filterOptions = toFilterOptions(
    currentSnapshots.map((snapshot) => getAppInfo(snapshot).name),
  );
  activityIdCol.filterOptions = toFilterOptions(
    currentSnapshots.map((snapshot) => snapshot.activityId),
  );
}

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
      return <SnapshotActionCard snapshot={row} onDelete={updateSnapshots} />;
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
    resetColWidth();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    resetColWidth();
  },
});

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
const showImportModal = shallowRef(false);
const textImportValue = shallowRef(``);
const importNetwork = useSingleTask(async () => {
  const input = textImportValue.value;
  const urls = input
    .trim()
    .split(`\n`)
    .map((u) => u.trim())
    .filter((u) => toValidURL(u));
  if (urls.length == 0) return;
  const r = await importFromNetwork(urls);
  if (!r) return;
  await snapshotsTask.run(() => {
    if (textImportValue.value === input) textImportValue.value = ``;
  });
});

useEventListener(document.body, 'paste', (e) => {
  if (showImportModal.value) return;
  const target = e.target as HTMLElement;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target.className || '').includes('input')
  ) {
    return;
  }
  const dataTransfer = e.clipboardData;
  if (!dataTransfer) return;
  const text = (dataTransfer.getData('text') || '').trim();
  if (text.startsWith('https://') || text.startsWith('http://')) {
    showImportModal.value = true;
    setTimeout(() => {
      textImportValue.value = text;
    });
  }
});

const checkedRowKeys = ref<number[]>([]);
const {
  batchDelete,
  batchDownloadImage,
  batchDownloadZip,
  batchShareImageUrl,
  batchShareZipUrl,
} = useBatchActions(checkedRowKeys, {
  prepareAfterDelete: async () => {
    const result = (await shallowSnapshotStorage.getAllItems()).reverse();
    return () => {
      snapshotsTask.cancel();
      snapshots.value = result;
      updateColumnFilterOptions();
    };
  },
});

const settingsDlgShow = shallowRef(false);
const setSettingsVisible = (visible: boolean) => {
  settingsDlgShow.value = visible;
};
const viewMode = shallowRef<'table' | 'group'>('table');
const setViewMode = (mode: 'table' | 'group') => {
  viewMode.value = mode;
};

const inputImportRef = shallowRef();
</script>
<template>
  <div
    class="flex flex-col overflow-hidden p-[10px] gap-[10px] w-(--gkd-w) h-(--gkd-h)"
  >
    <div class="flex">
      <NSpace>
        <NButtonGroup>
          <NButton
            :type="viewMode == 'table' ? 'primary' : 'default'"
            title="表格视图"
            aria-label="表格视图"
            :aria-pressed="viewMode == 'table'"
            @click="setViewMode('table')"
          >
            <template #icon><GkSvg name="view-table" /></template>
          </NButton>
          <NButton
            :type="viewMode == 'group' ? 'primary' : 'default'"
            title="分组视图"
            aria-label="分组视图"
            :aria-pressed="viewMode == 'group'"
            @click="setViewMode('group')"
          >
            <template #icon><GkSvg name="view-group" /></template>
          </NButton>
        </NButtonGroup>
        <NInputGroup>
          <NInput
            v-model:value="filterOption.query"
            placeholder="请输入应用名称/应用ID/界面ID"
            clearable
            class="min-w-[320px]"
            @keyup.enter="filterOption.updateQuery"
            @change="filterOption.updateQuery"
          />
          <NButton @click="filterOption.updateQuery">
            <template #icon>
              <GkSvg name="search" />
            </template>
          </NButton>
        </NInputGroup>
        <SnapshotBatchActionsBar
          :checkedCount="checkedRowKeys.length"
          :batchDelete="batchDelete"
          :batchDownloadImage="batchDownloadImage"
          :batchDownloadZip="batchDownloadZip"
          :batchShareImageUrl="batchShareImageUrl"
          :batchShareZipUrl="batchShareZipUrl"
        />
      </NSpace>
      <div class="flex-1" />
      <div class="[--svg-h:24px] flex gap-[24px] items-center pr-[8px]">
        <NTooltip>
          <template #trigger>
            <NButton text @click="setSettingsVisible(true)">
              <GkSvg name="settings" />
            </NButton>
          </template>
          设置
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <RouterLink class="flex" to="/selector/library">
              <NButton text aria-label="选择器库">
                <GkSvg name="selector-library" />
              </NButton>
            </RouterLink>
          </template>
          选择器库
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <RouterLink class="flex" to="/selector">
              <NButton text>
                <GkSvg name="terminal" />
              </NButton>
            </RouterLink>
          </template>
          测试选择器
        </NTooltip>
        <NPopover>
          <template #trigger>
            <NButton text>
              <GkSvg name="import" />
            </NButton>
          </template>
          <NSpace vertical>
            <NTooltip placement="left">
              <template #trigger>
                <NButton
                  :loading="importLocal.loading.value"
                  @click="importLocal.run()"
                >
                  导入本地文件
                </NButton>
              </template>
              <div class="whitespace-nowrap">支持拖拽文件到页面任意位置</div>
            </NTooltip>
            <NTooltip placement="left">
              <template #trigger>
                <NButton
                  :loading="importNetwork.loading.value"
                  @click="showImportModal = true"
                >
                  导入网络文件
                </NButton>
              </template>
              <div class="whitespace-nowrap">
                支持任意位置粘贴(Ctrl+V)文本触发导入
              </div>
            </NTooltip>
            <RouterLink class="flex" to="/log">
              <NButton class="w-full">查看日志包</NButton>
            </RouterLink>
          </NSpace>
        </NPopover>
        <NTooltip>
          <template #trigger>
            <RouterLink class="flex" to="/device">
              <NButton text>
                <GkSvg name="device" />
              </NButton>
            </RouterLink>
          </template>
          连接设备
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <a
              class="flex"
              href="https://github.com/orgs/gkd-kit/discussions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <GkSvg name="discussion" />
              </NButton>
            </a>
          </template>
          讨论交流
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <a
              class="flex"
              href="https://github.com/gkd-kit/inspect"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <GkSvg name="github" />
              </NButton>
            </a>
          </template>
          Github
        </NTooltip>
      </div>
    </div>
    <NDataTable
      v-if="viewMode == 'table'"
      v-model:checkedRowKeys="checkedRowKeys"
      striped
      virtualScroll
      :data="filterSnapshots"
      :columns="columns"
      :scrollX="1800"
      :rowKey="(r:Snapshot)=>r.id"
      size="small"
      class="flex-1"
      flex-height
      :loading="loading"
      @update:sorter="handleSorterChange"
    />
    <SnapshotGroupView
      v-else
      :snapshots="filterSnapshots"
      :checkedRowKeys="checkedRowKeys"
      :loading="loading"
      :updateSnapshots="updateSnapshots"
      @updateCheckedRowKeys="checkedRowKeys = $event"
    />
  </div>
  <NModal
    :show="showImportModal"
    preset="dialog"
    title="导入网络文件"
    :maskClosable="false"
    :showIcon="false"
    positiveText="确认"
    negativeText="取消"
    style="width: 800px"
    :loading="importNetwork.loading.value"
    @positiveClick="importNetwork.run"
    @negativeClick="showImportModal = false"
    @close="showImportModal = false"
    @esc="showImportModal = false"
    @afterEnter="inputImportRef?.focus()"
    @afterLeave="textImportValue = ``"
  >
    <NInput
      ref="inputImportRef"
      :value="textImportValue"
      type="textarea"
      :placeholder="`1.支持ZIP文件链接\n2.支持快照链接\n每行一个\n空白行自动忽略\n非法链接行自动忽略`"
      :autosize="{
        minRows: 8,
        maxRows: 16,
      }"
      :inputProps="{
        style: `white-space: nowrap;`,
      }"
      @update:value="
        if (!importNetwork.loading.value) {
          textImportValue = $event;
        }
      "
    />
  </NModal>

  <SettingsModal :show="settingsDlgShow" @update:show="setSettingsVisible" />
</template>
