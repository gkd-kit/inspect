<script lang="tsx" setup>
import type { RawSubscription } from '@gkd-kit/api';
import type { DataTableColumns } from 'naive-ui';
import type {
  SubscriptionFileDetail,
  SubscriptionFileSummary,
} from './directory_preview';
import DirectoryPreviewHeader from './DirectoryPreviewHeader.vue';
import JsonPreview from './JsonPreview.vue';
import SubscriptionPreview from './SubscriptionPreview.vue';
import TextSearchInput from './TextSearchInput.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  items: SubscriptionFileSummary[];
  detail?: SubscriptionFileDetail;
  detailStructured?: boolean;
  detailLoading?: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
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
      item.id == null ? `` : String(item.id),
      item.name || ``,
      item.version == null ? `` : String(item.version),
      item.author || ``,
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

const structuredDetail = computed(() => {
  if (!props.detailStructured || !props.detail?.parsed) return;
  return props.detail.value as RawSubscription;
});

const getStatusLabel = (status: SubscriptionFileSummary['status']) => {
  if (status == `valid`) return `完整`;
  if (status == `incomplete`) return `字段不完整`;
  if (status == `invalid`) return `解析失败`;
  return `不支持`;
};

const getStatusType = (status: SubscriptionFileSummary['status']) => {
  if (status == `valid`) return `success` as const;
  if (status == `incomplete`) return `warning` as const;
  if (status == `invalid`) return `error` as const;
  return `default` as const;
};

const openDetail = (item: SubscriptionFileSummary) => {
  selectedPath.value = item.path;
  activeTab.value = `detail`;
  emit(`select`, item.path);
};

const columns: DataTableColumns<SubscriptionFileSummary> = [
  {
    key: `id`,
    title: `ID`,
    width: 90,
    sorter: (a, b) => (a.id || 0) - (b.id || 0),
  },
  {
    key: `name`,
    title: `订阅名称`,
    minWidth: 260,
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
    key: `version`,
    title: `版本`,
    width: 100,
    render: (item) => item.version ?? `-`,
  },
  {
    key: `author`,
    title: `作者`,
    width: 150,
    render: (item) => item.author || `-`,
  },
  {
    key: `appsCount`,
    title: `应用`,
    width: 100,
    render: (item) => item.appsCount ?? `-`,
  },
  {
    key: `groups`,
    title: `全局规则组`,
    width: 120,
    render: (item) => item.globalGroupsCount ?? `-`,
  },
  {
    key: `categories`,
    title: `分类`,
    width: 100,
    render: (item) => item.categoriesCount ?? `-`,
  },
];

const rowProps = (item: SubscriptionFileSummary) => ({
  class: `cursor-pointer`,
  onClick: () => openDetail(item),
});
</script>

<template>
  <div
    name="subscription-directory-preview"
    class="h-full min-h-0 flex flex-col"
  >
    <DirectoryPreviewHeader
      title="订阅文件"
      :count="items.length"
      listLabel="订阅列表"
      :listActive="activeTab == 'list'"
      :detailText="selectedItem?.name || selectedItem?.fileName"
      :detailTitle="selectedItem?.path"
      @selectList="activeTab = 'list'"
    />

    <div
      v-if="activeTab == 'list'"
      class="min-h-0 flex flex-1 flex-col gap-10px"
    >
      <TextSearchInput
        v-model="query"
        v-model:match-case="searchOptions.matchCase"
        v-model:whole-word="searchOptions.wholeWord"
        v-model:use-regex="searchOptions.useRegex"
        placeholder="搜索订阅 ID、名称、作者或版本"
        class="flex-none"
      />
      <NEmpty
        v-if="pagedItems.length == 0"
        :description="query.trim() ? '没有匹配的订阅' : '没有订阅文件'"
        class="min-h-0 flex-1"
      />
      <NDataTable
        v-else
        striped
        :columns="columns"
        :data="pagedItems"
        :pagination="false"
        :rowKey="(item: SubscriptionFileSummary) => item.path"
        :rowProps="rowProps"
        :scrollX="1020"
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

    <div v-else class="min-h-0 flex flex-1 flex-col gap-10px">
      <NSpin v-if="detailLoading" show class="min-h-0 flex-1" />
      <NEmpty v-else-if="!detail" description="请选择一个订阅文件" />
      <div v-else class="min-h-0 flex-1">
        <SubscriptionPreview
          v-if="structuredDetail"
          :key="detail.path"
          :value="structuredDetail"
          :raw="detail.raw"
        />
        <JsonPreview
          v-else-if="detail.parsed"
          :key="detail.path"
          :value="detail.value"
          :raw="detail.raw"
        />
        <div v-else class="h-full min-h-0 flex flex-col gap-8px">
          <NAlert type="warning" title="订阅 JSON 解析失败" class="flex-none">
            {{ detail.error }}
          </NAlert>
          <TextViewer
            v-if="detail.raw"
            :value="detail.raw"
            search-placeholder="搜索原始内容"
            allow-wrap
            copyable
            class="min-h-0 flex-1"
          />
          <NEmpty v-else description="无法读取原始内容" />
        </div>
      </div>
    </div>
  </div>
</template>
