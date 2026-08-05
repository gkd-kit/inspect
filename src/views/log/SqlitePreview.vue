<script lang="tsx" setup>
import type { DataTableColumns } from 'naive-ui';
import type {
  SqliteCellValue,
  SqliteOpenResult,
  SqlitePageResult,
  SqliteTableMeta,
  SqliteWorkerRequest,
  SqliteWorkerResponse,
} from './sqlite.worker';
import TextSearchInput from './TextSearchInput.vue';
import {
  formatLocalDateTime,
  getSqliteTimeValue,
  isSqliteAppIdColumn,
  isSqliteSubscriptionIdColumn,
} from './sqlite_value';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  database: Uint8Array;
  wal?: Uint8Array;
  appNames?: Record<string, string>;
  subscriptionNames?: Record<string, string>;
}>();

const loading = shallowRef(true);
const pageLoading = shallowRef(false);
const errorText = shallowRef(``);
const pageErrorText = shallowRef(``);
const tables = shallowRef<SqliteTableMeta[]>([]);
const selectedTableName = shallowRef(``);
const page = shallowRef(1);
const pageSize = 100;
const columns = shallowRef<string[]>([]);
const rows = shallowRef<SqliteCellValue[][]>([]);
const tableQuery = shallowRef(``);
const tableSearchOptions = reactive(createTextSearchOptions());

const worker = new Worker(new URL(`./sqlite.worker.ts`, import.meta.url), {
  type: `module`,
});
let nextRequestId = 1;
let pageRequestSequence = 0;
const pending = new Map<
  number,
  {
    resolve: (value: SqliteOpenResult | SqlitePageResult | null) => void;
    reject: (reason: Error) => void;
  }
>();
type SqliteWorkerRequestWithoutId = SqliteWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, `id`>
    : never
  : never;

worker.onmessage = (event: MessageEvent<SqliteWorkerResponse>) => {
  const response = event.data;
  const task = pending.get(response.id);
  if (!task) return;
  pending.delete(response.id);
  if (response.ok) task.resolve(response.result);
  else task.reject(new Error(response.error));
};
worker.onerror = (event) => {
  const error = new Error(event.message || `SQLite Worker 运行失败`);
  for (const task of pending.values()) task.reject(error);
  pending.clear();
};

const requestWorker = <T,>(
  request: SqliteWorkerRequestWithoutId,
  transfer: Transferable[] = [],
) => {
  const id = nextRequestId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    worker.postMessage({ ...request, id } as SqliteWorkerRequest, transfer);
  });
};

const selectedTable = computed(() => {
  return tables.value.find((table) => table.name == selectedTableName.value);
});
const filteredTables = computed(() => {
  const query = tableQuery.value.trim();
  if (!query) return tables.value;
  return tables.value.filter((table) =>
    matchesTextSearch(table.name, query, tableSearchOptions),
  );
});

const loadPage = async () => {
  if (!selectedTableName.value) return;
  const requestSequence = ++pageRequestSequence;
  const table = selectedTableName.value;
  const requestedPage = page.value;
  pageLoading.value = true;
  pageErrorText.value = ``;
  try {
    const result = await requestWorker<SqlitePageResult>({
      type: `page`,
      table,
      page: requestedPage,
      pageSize,
    });
    if (
      requestSequence != pageRequestSequence ||
      table != selectedTableName.value ||
      requestedPage != page.value
    ) {
      return;
    }
    columns.value = result.columns;
    rows.value = result.rows;
  } catch (error) {
    if (requestSequence != pageRequestSequence) return;
    pageErrorText.value =
      error instanceof Error ? error.message : String(error);
  } finally {
    if (requestSequence == pageRequestSequence) pageLoading.value = false;
  }
};

watch(selectedTableName, () => {
  if (page.value == 1) void loadPage();
  else page.value = 1;
});
watch(page, loadPage);

const init = async () => {
  loading.value = true;
  errorText.value = ``;
  try {
    const database = props.database;
    const wal = props.wal;
    const transfer: Transferable[] = [database.buffer];
    if (wal) transfer.push(wal.buffer);
    const result = await requestWorker<SqliteOpenResult>(
      { type: `open`, database, wal },
      transfer,
    );
    tables.value = result.tables;
    selectedTableName.value = result.tables[0]?.name || ``;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
};

onMounted(init);
onBeforeUnmount(() => {
  worker.terminate();
  for (const task of pending.values()) task.reject(new Error(`组件已卸载`));
  pending.clear();
});

const renderSqlValue = (
  table: string,
  column: string,
  value: SqliteCellValue,
) => {
  if (value == null) {
    return <span class="italic text-[#9ca3af]">NULL</span>;
  }
  if (typeof value == `object`) {
    return <NTag size="small">{`BLOB · ${value.byteLength} bytes`}</NTag>;
  }
  if (isSqliteAppIdColumn(table, column) && typeof value == `string`) {
    const appName = props.appNames?.[value];
    if (appName) {
      return (
        <span class="whitespace-pre" title={value}>
          {appName}
        </span>
      );
    }
  }
  if (
    isSqliteSubscriptionIdColumn(table, column) &&
    (typeof value == `number` || typeof value == `string`)
  ) {
    const subscriptionName = props.subscriptionNames?.[String(value)];
    if (subscriptionName) {
      return (
        <span class="whitespace-pre" title={String(value)}>
          {subscriptionName}
        </span>
      );
    }
  }
  const time = getSqliteTimeValue(table, column, value);
  if (time) {
    return (
      <span class="whitespace-nowrap tabular-nums" title={String(value)}>
        {formatLocalDateTime(time)}
      </span>
    );
  }
  return <span class="whitespace-pre">{String(value)}</span>;
};

const tableColumns = computed<
  DataTableColumns<Record<string, SqliteCellValue>>
>(() => {
  return columns.value.map((name) => ({
    key: name,
    title: name,
    render(row) {
      return renderSqlValue(selectedTableName.value, name, row[name] ?? null);
    },
  }));
});
const tableRows = computed(() => {
  return rows.value.map((values, index) => {
    const row: Record<string, SqliteCellValue> = { __rowIndex: index };
    columns.value.forEach((name, columnIndex) => {
      row[name] = values[columnIndex] ?? null;
    });
    return row;
  });
});
</script>

<template>
  <NSpin
    :show="loading"
    class="h-full min-h-0 [&_.n-spin-content]:h-full [&_.n-spin-content]:min-h-0"
  >
    <NAlert v-if="errorText" type="error" title="数据库无法预览">
      {{ errorText }}
    </NAlert>
    <NEmpty
      v-else-if="!loading && tables.length == 0"
      description="数据库中没有可展示的数据表"
    />
    <div v-else name="sqlite-layout" class="h-full min-h-0 flex gap-12px">
      <aside
        name="sqlite-table-list"
        class="w-250px min-w-250px flex flex-col gap-8px border-r border-[#e5e7eb] pr-10px"
      >
        <TextSearchInput
          v-model="tableQuery"
          v-model:match-case="tableSearchOptions.matchCase"
          v-model:whole-word="tableSearchOptions.wholeWord"
          v-model:use-regex="tableSearchOptions.useRegex"
          placeholder="搜索数据表"
        />
        <div name="sqlite-table-scroll" class="min-h-0 overflow-auto">
          <NButton
            v-for="table in filteredTables"
            :key="table.name"
            block
            text
            :type="table.name == selectedTableName ? 'primary' : 'default'"
            class="h-34px justify-between px-6px"
            @click="selectedTableName = table.name"
          >
            <span
              class="flex-1 overflow-hidden text-left text-ellipsis leading-20px"
            >
              {{ table.name }}
            </span>
            <NTag size="small" :bordered="false">
              {{ table.count ?? `?` }}
            </NTag>
          </NButton>
        </div>
      </aside>

      <section
        v-if="selectedTable"
        name="sqlite-table-content"
        class="h-full min-h-0 min-w-0 flex-1"
      >
        <NTabs
          type="line"
          animated
          class="h-full min-h-0 min-w-0 flex-1 [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tab-pane]:min-w-0 [&_.n-tab-pane]:flex-1 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0 [&_.n-tabs-pane-wrapper]:min-w-0 [&_.n-tabs-pane-wrapper]:flex-1"
        >
          <NTabPane
            name="data"
            :tab="
              selectedTable.count == null
                ? '数据'
                : `数据 · ${selectedTable.count}`
            "
          >
            <div
              name="sqlite-data-pane"
              class="h-full min-h-0 flex flex-col items-end gap-10px"
            >
              <NAlert
                v-if="pageErrorText"
                type="warning"
                title="当前数据表无法读取"
                class="w-full flex-none"
              >
                {{ pageErrorText }}
              </NAlert>
              <div
                name="sqlite-data-table-scroll"
                class="w-full min-h-0 flex-1 overflow-auto"
              >
                <NDataTable
                  striped
                  table-layout="auto"
                  :loading="pageLoading"
                  :columns="tableColumns"
                  :data="tableRows"
                  :pagination="false"
                  :rowKey="(row: Record<string, SqliteCellValue>) => Number(row.__rowIndex)"
                  size="small"
                  class="w-full [&_.n-data-table-table]:min-w-full [&_.n-data-table-table]:w-max [&_.n-data-table-th]:whitespace-nowrap"
                />
              </div>
              <NPagination
                v-if="
                  selectedTable.count != null && selectedTable.count > pageSize
                "
                v-model:page="page"
                :pageSize="pageSize"
                :itemCount="selectedTable.count"
              />
            </div>
          </NTabPane>
          <NTabPane name="schema" tab="表结构">
            <pre
              name="sqlite-schema"
              class="box-border m-0 h-full overflow-auto whitespace-pre-wrap rounded-4px border border-[#e5e7eb] bg-[#fafafa] p-12px"
              >{{ selectedTable.sql }}</pre
            >
          </NTabPane>
        </NTabs>
      </section>
    </div>
  </NSpin>
</template>
