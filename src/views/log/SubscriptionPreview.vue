<script lang="tsx" setup>
import type {
  IArray,
  RawApp,
  RawAppGroup,
  RawGlobalGroup,
  RawSubscription,
} from '@gkd-kit/api';
import type { DataTableColumns } from 'naive-ui';
import RawJsonPreview from './RawJsonPreview.vue';
import { getSafeHttpUrl } from './safe_url';
import TextSearchInput from './TextSearchInput.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  value: RawSubscription;
  raw: string;
}>();

const safeUpdateUrl = computed(() => getSafeHttpUrl(props.value.updateUrl));
const safeSupportUri = computed(() => getSafeHttpUrl(props.value.supportUri));

const toArray = <T,>(value: IArray<T> | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const apps = computed(() => props.value.apps || []);
const globalGroups = computed(() => props.value.globalGroups || []);
const categories = computed(() => props.value.categories || []);
const statistics = computed(() => {
  let appGroups = 0;
  let appRules = 0;
  for (const app of apps.value) {
    appGroups += app.groups.length;
    for (const group of app.groups) appRules += toArray(group.rules).length;
  }
  let globalRules = 0;
  for (const group of globalGroups.value) {
    globalRules += toArray(group.rules).length;
  }
  return {
    apps: apps.value.length,
    appGroups,
    appRules,
    globalGroups: globalGroups.value.length,
    globalRules,
    categories: categories.value.length,
  };
});

const appQuery = shallowRef(``);
const appSearchOptions = reactive(createTextSearchOptions());
const appPage = shallowRef(1);
const appPageSize = 50;
const filteredApps = computed(() => {
  const query = appQuery.value.trim();
  if (!query) return apps.value;
  return apps.value.filter(
    (app) =>
      matchesTextSearch(app.id, query, appSearchOptions) ||
      matchesTextSearch(app.name || ``, query, appSearchOptions),
  );
});
watch(filteredApps, () => (appPage.value = 1));
const pagedApps = computed(() => {
  const offset = (appPage.value - 1) * appPageSize;
  return filteredApps.value.slice(offset, offset + appPageSize);
});

const getRuleTitle = (rule: unknown, index: number) => {
  if (typeof rule == `string`) return `规则 ${index + 1}`;
  if (rule && typeof rule == `object`) {
    const value = rule as Record<string, unknown>;
    return String(value.name || `规则 ${index + 1}`);
  }
  return `规则 ${index + 1}`;
};

const renderRules = (group: RawAppGroup | RawGlobalGroup) => {
  const rules = toArray<unknown>(group.rules as IArray<unknown>);
  return (
    <NCollapse accordion>
      {rules.map((rule, index) => (
        <NCollapseItem
          key={index}
          name={index}
          title={getRuleTitle(rule, index)}
        >
          <pre class="m-0 whitespace-pre-wrap rounded-4px border border-[#e5e7eb] bg-[#fafafa] p-10px font-mono text-12px [overflow-wrap:anywhere]">
            {JSON.stringify(rule, null, 2)}
          </pre>
        </NCollapseItem>
      ))}
    </NCollapse>
  );
};

const renderAppGroups = (app: RawApp) => {
  return (
    <div {...{ name: `subscription-groups` }} class="flex flex-col gap-10px">
      {app.groups.map((group) => (
        <NCard
          key={group.key}
          size="small"
          title={`${group.name} · #${group.key}`}
        >
          {group.desc ? (
            <div class="mb-10px text-[#6b7280]">{group.desc}</div>
          ) : null}
          {renderRules(group)}
        </NCard>
      ))}
    </div>
  );
};

const categoryColumns: DataTableColumns<
  NonNullable<RawSubscription['categories']>[number]
> = [
  { key: `key`, title: `Key`, width: 100 },
  { key: `name`, title: `名称` },
  {
    key: `enable`,
    title: `默认状态`,
    width: 140,
    render(row) {
      return row.enable == null ? `跟随规则组` : row.enable ? `启用` : `禁用`;
    },
  },
];
</script>

<template>
  <div
    name="subscription-preview"
    class="h-full min-h-0 flex flex-col gap-12px"
  >
    <NDescriptions bordered size="small" :column="3" labelPlacement="left">
      <NDescriptionsItem label="名称">{{ value.name }}</NDescriptionsItem>
      <NDescriptionsItem label="ID">{{ value.id }}</NDescriptionsItem>
      <NDescriptionsItem label="版本">{{ value.version }}</NDescriptionsItem>
      <NDescriptionsItem v-if="value.author" label="作者">
        {{ value.author }}
      </NDescriptionsItem>
      <NDescriptionsItem v-if="safeUpdateUrl" label="更新地址">
        <a :href="safeUpdateUrl" target="_blank" rel="noopener noreferrer">
          {{ value.updateUrl }}
        </a>
      </NDescriptionsItem>
      <NDescriptionsItem v-if="safeSupportUri" label="反馈地址">
        <a :href="safeSupportUri" target="_blank" rel="noopener noreferrer">
          {{ value.supportUri }}
        </a>
      </NDescriptionsItem>
    </NDescriptions>

    <div name="subscription-stats" class="flex flex-wrap gap-12px">
      <NStatistic
        v-if="statistics.apps"
        label="应用"
        :value="statistics.apps"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        v-if="statistics.appGroups"
        label="应用规则组"
        :value="statistics.appGroups"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        v-if="statistics.appRules"
        label="应用规则"
        :value="statistics.appRules"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        v-if="statistics.globalGroups"
        label="全局规则组"
        :value="statistics.globalGroups"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        v-if="statistics.globalRules"
        label="全局规则"
        :value="statistics.globalRules"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        v-if="statistics.categories"
        label="分类"
        :value="statistics.categories"
        class="min-w-120px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
    </div>

    <NTabs
      type="line"
      animated
      class="h-full min-h-0 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
    >
      <NTabPane v-if="apps.length" name="apps" tab="应用规则">
        <div
          name="subscription-tab-body"
          class="h-full min-h-0 flex flex-col gap-10px"
        >
          <TextSearchInput
            v-model="appQuery"
            v-model:match-case="appSearchOptions.matchCase"
            v-model:whole-word="appSearchOptions.wholeWord"
            v-model:use-regex="appSearchOptions.useRegex"
            placeholder="搜索应用名称或包名"
          />
          <NEmpty v-if="pagedApps.length == 0" description="没有匹配的应用" />
          <NCollapse v-else accordion class="min-h-0 flex-1 overflow-auto">
            <NCollapseItem
              v-for="app in pagedApps"
              :key="app.id"
              :name="app.id"
              :title="`${app.name || app.id} · ${app.groups.length} 个规则组`"
            >
              <div name="app-id" class="mb-10px text-[#6b7280]">
                {{ app.id }}
              </div>
              <component :is="() => renderAppGroups(app)" />
            </NCollapseItem>
          </NCollapse>
          <NPagination
            v-if="filteredApps.length > appPageSize"
            v-model:page="appPage"
            :pageSize="appPageSize"
            :itemCount="filteredApps.length"
          />
        </div>
      </NTabPane>

      <NTabPane v-if="globalGroups.length" name="global" tab="全局规则">
        <div
          name="subscription-global-groups"
          class="min-h-0 flex flex-col gap-10px overflow-auto"
        >
          <NCard
            v-for="group in globalGroups"
            :key="group.key"
            size="small"
            :title="`${group.name} · #${group.key}`"
          >
            <div v-if="group.desc" class="mb-10px text-[#6b7280]">
              {{ group.desc }}
            </div>
            <component :is="() => renderRules(group)" />
          </NCard>
        </div>
      </NTabPane>

      <NTabPane v-if="categories.length" name="categories" tab="分类">
        <NDataTable
          striped
          :columns="categoryColumns"
          :data="categories"
          :pagination="false"
        />
      </NTabPane>

      <NTabPane name="raw" tab="原始 JSON">
        <RawJsonPreview :value="value" :raw="raw" />
      </NTabPane>
    </NTabs>
  </div>
</template>
