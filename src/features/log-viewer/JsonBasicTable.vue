<script setup lang="tsx">
import type { DataTableColumns } from 'naive-ui';
import { formatBasicJsonValue, type JsonTableRow } from './json_preview';

const props = withDefaults(
  defineProps<{
    rows: JsonTableRow[];
    indexed?: boolean;
  }>(),
  { indexed: false },
);

const columns = computed<DataTableColumns<JsonTableRow>>(() => [
  {
    key: `key`,
    title: props.indexed ? `索引` : `键`,
    width: 220,
    ellipsis: { tooltip: true },
  },
  {
    key: `value`,
    title: `值`,
    render(row) {
      return (
        <span class="whitespace-pre-wrap font-mono [overflow-wrap:anywhere]">
          {formatBasicJsonValue(row.value)}
        </span>
      );
    },
  },
]);
const pagination = computed(() => {
  return props.rows.length > 200
    ? { pageSize: 200, showSizePicker: false }
    : false;
});
const getRowKey = (row: JsonTableRow) => row.key;
</script>

<template>
  <div name="json-basic-table" class="mb-10px mt-6px">
    <NDataTable
      striped
      size="small"
      :columns="columns"
      :data="rows"
      :rowKey="getRowKey"
      :pagination="pagination"
    />
  </div>
</template>
