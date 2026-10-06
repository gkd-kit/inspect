<script setup lang="ts">
import {
  getDiagnosticRows,
  getPermissionRows,
  type DiagnosticKind,
} from './diagnostic_preview';
import RawJsonPreview from './RawJsonPreview.vue';

const props = defineProps<{
  kind: DiagnosticKind;
  value: unknown;
  raw: string;
}>();
const rawView = shallowRef(false);
const setRawView = (value: boolean) => {
  rawView.value = value;
};
const rows = computed(() => getDiagnosticRows(props.kind, props.value));
const permissions = computed(() => getPermissionRows(props.value));
const titles = {
  permission: `权限信息`,
  storage: `存储诊断`,
  startup: `启动记录`,
};
const columns = [
  { key: `name`, title: `权限` },
  { key: `id`, title: `标识` },
  { key: `status`, title: `状态` },
  { key: `checkedAt`, title: `检查时间` },
];
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-12px">
    <div class="flex flex-none items-center gap-12px">
      <span class="font-600">{{ titles[kind] }}</span>
      <NButtonGroup size="small">
        <NButton
          :type="!rawView ? 'primary' : 'default'"
          @click="setRawView(false)"
          >概览</NButton
        >
        <NButton
          :type="rawView ? 'primary' : 'default'"
          @click="setRawView(true)"
          >原始 JSON</NButton
        >
      </NButtonGroup>
    </div>
    <RawJsonPreview
      v-if="rawView"
      :value="value"
      :raw="raw"
      class="min-h-0 flex-1"
    />
    <div v-else class="min-h-0 flex-1 overflow-auto">
      <NAlert v-if="kind == 'permission'" type="info" class="mb-12px"
        >这是日志包中保存的检查结果，并非实时权限状态。</NAlert
      >
      <table class="mb-16px w-full border-collapse text-13px">
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.label"
            class="border-b border-[#e5e7eb]"
          >
            <th class="w-180px p-8px text-left font-500">{{ row.label }}</th>
            <td class="p-8px [overflow-wrap:anywhere]">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
      <NDataTable
        v-if="kind == 'permission' && permissions.length"
        :columns="columns"
        :data="permissions"
        :pagination="false"
        striped
      />
      <NEmpty
        v-else-if="kind == 'permission'"
        description="没有可识别的权限记录，可查看原始 JSON"
      />
    </div>
  </div>
</template>
