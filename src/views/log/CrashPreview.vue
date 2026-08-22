<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import type { CrashDetail, CrashSummary } from './crash_preview';
import { formatCrashTimestamp } from './crash_preview';
import DirectoryPreviewHeader from './DirectoryPreviewHeader.vue';
import RawJsonPreview from './RawJsonPreview.vue';
import type { SourceLinkContext } from './source_links';
import StackRetraceButton from './StackRetraceButton.vue';
import TextSearchInput from './TextSearchInput.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  items: CrashSummary[];
  detail?: CrashDetail;
  detailLoading?: boolean;
  retraceAvailable?: boolean;
  retraceLoading?: boolean;
  retraceActive?: boolean;
  sourceLinkContext?: SourceLinkContext;
}>();

const emit = defineEmits<{
  select: [path: string];
  toggleRetrace: [];
}>();

const activeTab = shallowRef<`list` | `detail`>(`list`);
const selectedPath = shallowRef(``);
const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());
const page = shallowRef(1);
const pageSize = 50;

const filteredItems = computed(() => {
  const actualQuery = query.value.trim();
  if (!actualQuery) return props.items;
  return props.items.filter((item) => {
    const values = [
      item.fileName,
      item.name || ``,
      item.message || ``,
      item.thread || ``,
      item.device || ``,
      item.versionName || ``,
      item.versionCode == null ? `` : String(item.versionCode),
      item.androidVersionName || ``,
      item.androidVersionCode == null ? `` : String(item.androidVersionCode),
      item.error || ``,
    ];
    return values.some((value) =>
      matchesTextSearch(value, actualQuery, searchOptions),
    );
  });
});

watch(filteredItems, () => (page.value = 1));
watch(
  () => props.items,
  (items) => {
    if (!items.some((item) => item.path == selectedPath.value)) {
      selectedPath.value = ``;
      activeTab.value = `list`;
    }
  },
);

const pagedItems = computed(() => {
  const offset = (page.value - 1) * pageSize;
  return filteredItems.value.slice(offset, offset + pageSize);
});

const selectedItem = computed(() => {
  return props.items.find((item) => item.path == selectedPath.value);
});

const getVersionText = (name: string | undefined, code: number | undefined) => {
  if (name && code != null) return `${name} (${code})`;
  return name || code?.toString() || `-`;
};

const getStatusLabel = (status: CrashSummary['status']) => {
  if (status == `valid`) return `完整`;
  if (status == `incomplete`) return `字段不完整`;
  if (status == `invalid`) return `解析失败`;
  return `不支持`;
};

const getStatusType = (status: CrashSummary['status']) => {
  if (status == `valid`) return `success` as const;
  if (status == `incomplete`) return `warning` as const;
  if (status == `invalid`) return `error` as const;
  return `default` as const;
};

const openDetail = (item: CrashSummary) => {
  selectedPath.value = item.path;
  activeTab.value = `detail`;
  emit(`select`, item.path);
};

const columns: DataTableColumns<CrashSummary> = [
  {
    key: `timestamp`,
    title: `时间`,
    width: 190,
    sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    render: (item) => formatCrashTimestamp(item.timestamp),
  },
  {
    key: `name`,
    title: `异常类型`,
    width: 280,
    ellipsis: { tooltip: true },
    render(item) {
      return (
        <div class="min-w-0 flex items-center gap-6px">
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {item.name || item.fileName}
          </span>
          {item.status == `valid` ? null : (
            <NTag size="small" type={getStatusType(item.status)}>
              {getStatusLabel(item.status)}
            </NTag>
          )}
        </div>
      );
    },
  },
  {
    key: `message`,
    title: `异常消息`,
    width: 360,
    ellipsis: { tooltip: true },
    render: (item) => item.message || item.error || `-`,
  },
  {
    key: `thread`,
    title: `线程`,
    width: 100,
    render: (item) => item.thread || `-`,
  },
  {
    key: `version`,
    title: `GKD 版本`,
    width: 180,
    render: (item) => getVersionText(item.versionName, item.versionCode),
  },
  {
    key: `android`,
    title: `Android`,
    width: 140,
    render: (item) =>
      getVersionText(item.androidVersionName, item.androidVersionCode),
  },
  {
    key: `device`,
    title: `设备`,
    width: 260,
    ellipsis: { tooltip: true },
    render: (item) => item.device || `-`,
  },
];

const rowProps = (item: CrashSummary) => ({
  class: `cursor-pointer`,
  onClick: () => openDetail(item),
});
</script>

<template>
  <div name="crash-preview" class="h-full min-h-0 flex flex-col">
    <DirectoryPreviewHeader
      title="崩溃记录"
      :count="items.length"
      listLabel="崩溃列表"
      :listActive="activeTab == 'list'"
      :detailText="selectedItem?.fileName"
      :detailTitle="selectedItem?.path"
      @selectList="activeTab = 'list'"
    />

    <div
      v-if="activeTab == 'list'"
      name="crash-list"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <TextSearchInput
        v-model="query"
        v-model:match-case="searchOptions.matchCase"
        v-model:whole-word="searchOptions.wholeWord"
        v-model:use-regex="searchOptions.useRegex"
        placeholder="搜索异常类型、消息、设备或版本"
        class="flex-none"
      />
      <NEmpty
        v-if="pagedItems.length == 0"
        :description="query.trim() ? '没有匹配的崩溃记录' : '没有崩溃记录'"
        class="min-h-0 flex-1"
      />
      <NDataTable
        v-else
        striped
        flexHeight
        virtualScroll
        :columns="columns"
        :data="pagedItems"
        :pagination="false"
        :rowKey="(item: CrashSummary) => item.path"
        :rowProps="rowProps"
        :scrollX="1510"
        class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
      />
      <NPagination
        v-if="filteredItems.length > pageSize"
        v-model:page="page"
        :pageSize="pageSize"
        :itemCount="filteredItems.length"
        class="flex-none justify-end"
      />
    </div>

    <div
      v-else
      name="crash-detail"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <NSpin v-if="detailLoading" show class="min-h-0 flex-1" />
      <NEmpty v-else-if="!detail" description="请选择一条崩溃记录" />
      <template v-else>
        <NAlert
          v-if="detail.error"
          type="warning"
          title="该记录无法完整解析"
          class="flex-none"
        >
          {{ detail.error }}
        </NAlert>
        <NDescriptions
          bordered
          size="small"
          :column="3"
          labelPlacement="left"
          class="flex-none"
        >
          <NDescriptionsItem label="时间">
            {{ formatCrashTimestamp(detail.timestamp) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="线程">
            {{ detail.thread || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="GKD 版本">
            {{ getVersionText(detail.versionName, detail.versionCode) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Android">
            {{
              getVersionText(
                detail.androidVersionName,
                detail.androidVersionCode,
              )
            }}
          </NDescriptionsItem>
          <NDescriptionsItem label="设备" :span="2">
            {{ detail.device || '-' }}
          </NDescriptionsItem>
        </NDescriptions>

        <NTabs
          type="line"
          animated
          class="min-h-0 flex-1 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
        >
          <NTabPane name="stack" tab="堆栈">
            <TextViewer
              v-if="detail.stackTrace"
              :value="detail.stackTrace"
              :documentKey="detail.path"
              search-placeholder="搜索崩溃堆栈"
              allow-wrap
              copyable
              :sourceLinkContext="sourceLinkContext"
              class="h-full"
            >
              <template #toolbar-start>
                <StackRetraceButton
                  :available="retraceAvailable"
                  :loading="retraceLoading"
                  :retraced="retraceActive"
                  @toggle="emit('toggleRetrace')"
                />
              </template>
            </TextViewer>
            <NEmpty v-else description="该记录没有堆栈信息" />
          </NTabPane>
          <NTabPane name="raw" tab="原始 JSON">
            <RawJsonPreview
              v-if="detail.parsed"
              :value="detail.value"
              :raw="detail.raw"
            />
            <TextViewer
              v-else-if="detail.raw"
              :value="detail.raw"
              search-placeholder="搜索原始内容"
              allow-wrap
              copyable
              class="h-full"
            />
            <NEmpty v-else description="无法读取原始内容" />
          </NTabPane>
        </NTabs>
      </template>
    </div>
  </div>
</template>
