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
  view: `users` | `raw`;
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
const userOptions = computed(() => {
  return props.data.users.map((user) => ({
    label: `${user.name} · 用户 ${user.id} · ${user.apps.length} 个应用`,
    value: user.id,
  }));
});

const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());
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
  <div name="apps-preview" class="h-full min-h-0 flex flex-col">
    <div
      v-if="view == 'users' && selectedUser"
      name="user-apps"
      class="h-full min-h-0 min-w-0 flex flex-col gap-10px"
    >
      <div name="user-apps-header" class="min-w-0 flex items-center gap-16px">
        <NSelect
          v-model:value="selectedUserId"
          :options="userOptions"
          aria-label="设备用户"
          class="min-w-280px w-40% max-w-420px"
        />
        <TextSearchInput
          v-model="query"
          v-model:match-case="searchOptions.matchCase"
          v-model:whole-word="searchOptions.wholeWord"
          v-model:use-regex="searchOptions.useRegex"
          placeholder="搜索应用名称、包名或版本"
          class="ml-auto min-w-320px w-50% max-w-460px"
        />
      </div>

      <NEmpty
        v-if="filteredApps.length == 0"
        :description="query.trim() ? '没有匹配的应用' : '该用户没有应用记录'"
        class="min-h-0 flex-1"
      />
      <NDataTable
        v-else
        striped
        flexHeight
        virtualScroll
        :columns="columns"
        :data="filteredApps"
        :pagination="false"
        :rowKey="(app: DeviceApp) => app.id"
        class="min-h-0 flex-1 [&_.n-data-table-wrapper]:h-full"
      />
    </div>
    <RawJsonPreview v-else :value="value" :raw="raw" />
  </div>
</template>
