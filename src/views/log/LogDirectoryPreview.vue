<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import { formatLogFileDate, type LogFileSummary } from './directory_preview';
import { formatBytes } from './log';
import TextSearchInput from './TextSearchInput.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  items: LogFileSummary[];
  detailPath?: string;
  detailText?: string;
  detailError?: string;
  detailLoading?: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const activeTab = shallowRef<`list` | `detail`>(`list`);
const selectedPath = shallowRef(``);
const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());

const filteredItems = computed(() => {
  const actualQuery = query.value.trim();
  if (!actualQuery) return props.items;
  return props.items.filter((item) => {
    return [item.fileName, formatLogFileDate(item.timestamp)].some((value) =>
      matchesTextSearch(value, actualQuery, searchOptions),
    );
  });
});

watch(
  () => props.items,
  (items) => {
    if (!items.some((item) => item.path == selectedPath.value)) {
      selectedPath.value = ``;
      activeTab.value = `list`;
    }
  },
);

const selectedItem = computed(() => {
  return props.items.find((item) => item.path == selectedPath.value);
});

const openDetail = (item: LogFileSummary) => {
  selectedPath.value = item.path;
  activeTab.value = `detail`;
  emit(`select`, item.path);
};

const columns: DataTableColumns<LogFileSummary> = [
  {
    key: `date`,
    title: `日期`,
    width: 180,
    sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    render: (item) => formatLogFileDate(item.timestamp),
  },
  { key: `fileName`, title: `文件名` },
  {
    key: `size`,
    title: `大小`,
    width: 140,
    sorter: (a, b) => a.size - b.size,
    render: (item) => formatBytes(item.size),
  },
];

const rowProps = (item: LogFileSummary) => ({
  class: `cursor-pointer`,
  onClick: () => openDetail(item),
});
</script>

<template>
  <div name="log-directory-preview" class="h-full min-h-0 flex flex-col">
    <div
      name="log-directory-title"
      class="h-40px flex flex-none items-center gap-8px border-b border-[#e5e7eb] px-4px pb-10px font-600"
    >
      <span>运行日志</span>
      <NTag size="small" round>{{ items.length }}</NTag>
    </div>

    <NTabs
      v-model:value="activeTab"
      type="line"
      animated
      class="min-h-0 flex-1 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
    >
      <NTabPane name="list" tab="日志列表">
        <div class="h-full min-h-0 flex flex-col gap-10px">
          <TextSearchInput
            v-model="query"
            v-model:match-case="searchOptions.matchCase"
            v-model:whole-word="searchOptions.wholeWord"
            v-model:use-regex="searchOptions.useRegex"
            placeholder="搜索日志日期或文件名"
            class="flex-none"
          />
          <NEmpty
            v-if="filteredItems.length == 0"
            :description="query.trim() ? '没有匹配的日志文件' : '没有日志文件'"
            class="min-h-0 flex-1"
          />
          <NDataTable
            v-else
            striped
            :columns="columns"
            :data="filteredItems"
            :pagination="false"
            :rowKey="(item: LogFileSummary) => item.path"
            :rowProps="rowProps"
            class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
          />
        </div>
      </NTabPane>

      <NTabPane name="detail" tab="详情" :disabled="!selectedPath">
        <div class="h-full min-h-0 flex flex-col gap-10px">
          <div class="flex flex-none items-center gap-10px">
            <NButton size="small" @click="activeTab = 'list'">
              返回日志列表
            </NButton>
            <span
              class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-600"
              :title="selectedItem?.path"
            >
              {{ selectedItem?.fileName }}
            </span>
            <span class="text-12px text-[#64748b]">
              {{ selectedItem ? formatBytes(selectedItem.size) : '' }}
            </span>
          </div>
          <NSpin v-if="detailLoading" show class="min-h-0 flex-1" />
          <NAlert v-else-if="detailError" type="error" title="日志文件读取失败">
            {{ detailError }}
          </NAlert>
          <TextViewer
            v-else-if="detailPath && detailText != null"
            :key="detailPath"
            :value="detailText"
            search-placeholder="搜索当前日志文件"
            allow-wrap
            copyable
            class="min-h-0 flex-1"
          />
          <NEmpty v-else description="请选择一个日志文件" />
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>
