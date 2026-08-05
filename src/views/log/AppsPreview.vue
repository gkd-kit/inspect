<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import type { AppsPreviewData, DeviceApp } from './apps_preview';
import RawJsonPreview from './RawJsonPreview.vue';
import TextSearchInput from './TextSearchInput.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  data: AppsPreviewData;
  value: unknown;
  raw: string;
}>();

const selectedUserId = shallowRef(props.data.users[0]?.id);
watch(
  () => props.data,
  (data) => (selectedUserId.value = data.users[0]?.id),
);
const selectedUser = computed(() => {
  return (
    props.data.users.find((user) => user.id == selectedUserId.value) ||
    props.data.users[0]
  );
});

const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());
const page = shallowRef(1);
const pageSize = 50;
const filteredApps = computed(() => {
  const apps = selectedUser.value?.apps || [];
  const actualQuery = query.value.trim();
  if (!actualQuery) return apps;
  return apps.filter((app) => {
    const values = [
      app.name,
      app.id,
      app.versionName || ``,
      app.versionCode == null ? `` : String(app.versionCode),
    ];
    return values.some((value) =>
      matchesTextSearch(value, actualQuery, searchOptions),
    );
  });
});
watch([selectedUserId, filteredApps], () => (page.value = 1));
const pagedApps = computed(() => {
  const offset = (page.value - 1) * pageSize;
  return filteredApps.value.slice(offset, offset + pageSize);
});

const columns: DataTableColumns<DeviceApp> = [
  { key: `name`, title: `应用名称` },
  { key: `id`, title: `包名` },
  {
    key: `version`,
    title: `版本`,
    render(app) {
      if (app.versionName && app.versionCode != null) {
        return `${app.versionName} (${app.versionCode})`;
      }
      return app.versionName || app.versionCode?.toString() || `-`;
    },
  },
  {
    key: `isSystem`,
    title: `类型`,
    render(app) {
      if (app.isSystem == null) return `-`;
      return (
        <NTag size="small" type={app.isSystem ? `info` : `default`}>
          {app.isSystem ? `系统应用` : `用户应用`}
        </NTag>
      );
    },
  },
  {
    key: `state`,
    title: `状态`,
    render(app) {
      const states = [
        app.enabled === false ? `已停用` : undefined,
        app.hidden ? `已隐藏` : undefined,
      ].filter(Boolean);
      return states.length ? states.join(` · `) : `正常`;
    },
  },
];
</script>

<template>
  <div name="apps-preview" class="h-full min-h-0 flex flex-col gap-12px">
    <div name="apps-overview" class="flex gap-12px">
      <NStatistic
        label="设备用户"
        :value="data.users.length"
        class="min-w-140px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
      <NStatistic
        label="应用安装记录"
        :value="data.totalApps"
        class="min-w-140px rounded-6px border border-[#e5e7eb] bg-[#fafafa] px-14px py-10px"
      />
    </div>

    <NTabs
      type="line"
      animated
      class="h-full min-h-0 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
    >
      <NTabPane name="users" tab="按用户查看">
        <div name="apps-users-layout" class="h-full min-h-0 flex gap-12px">
          <aside
            name="user-list"
            aria-label="设备用户"
            class="w-220px min-w-220px overflow-auto pr-2px"
          >
            <button
              v-for="(user, index) in data.users"
              :key="user.id"
              type="button"
              class="relative w-full flex cursor-pointer flex-col items-start rounded-6px border px-12px py-10px text-left text-inherit"
              :class="[
                index ? 'mt-6px' : '',
                user.id == selectedUserId
                  ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                  : 'border-transparent bg-transparent hover:bg-[#f8fafc]',
              ]"
              @click="selectedUserId = user.id"
            >
              <span class="max-w-full flex items-center gap-6px font-600">
                {{ user.name }}
                <NTag v-if="user.isCurrent" size="tiny" type="success">
                  当前
                </NTag>
              </span>
              <span class="mt-3px text-12px text-[#64748b]">
                用户 {{ user.id }}
              </span>
              <span class="mt-8px text-12px text-[#64748b]">
                {{ user.apps.length }} 个应用
              </span>
            </button>
          </aside>

          <section
            v-if="selectedUser"
            name="user-apps"
            class="min-h-0 min-w-0 flex flex-1 flex-col gap-10px"
          >
            <header
              name="user-apps-header"
              class="min-w-0 flex items-center gap-16px"
            >
              <div
                name="selected-user-title"
                class="min-w-150px flex flex-col font-600"
              >
                <span>{{ selectedUser.name }}</span>
                <span class="text-12px text-[#64748b]">
                  用户 {{ selectedUser.id }} ·
                  {{ selectedUser.apps.length }} 个应用
                </span>
              </div>
              <TextSearchInput
                v-model="query"
                v-model:match-case="searchOptions.matchCase"
                v-model:whole-word="searchOptions.wholeWord"
                v-model:use-regex="searchOptions.useRegex"
                placeholder="搜索应用名称、包名或版本"
                class="ml-auto min-w-320px w-50% max-w-460px"
              />
            </header>

            <NEmpty
              v-if="pagedApps.length == 0"
              :description="
                query.trim() ? '没有匹配的应用' : '该用户没有应用记录'
              "
              class="min-h-0 flex-1"
            />
            <NDataTable
              v-else
              striped
              :columns="columns"
              :data="pagedApps"
              :pagination="false"
              :rowKey="(app: DeviceApp) => app.id"
              class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
            />
            <NPagination
              v-if="filteredApps.length > pageSize"
              v-model:page="page"
              :pageSize="pageSize"
              :itemCount="filteredApps.length"
              class="flex-none justify-end"
            />
          </section>
        </div>
      </NTabPane>

      <NTabPane name="raw" tab="原始 JSON">
        <RawJsonPreview :value="value" :raw="raw" />
      </NTabPane>
    </NTabs>
  </div>
</template>
