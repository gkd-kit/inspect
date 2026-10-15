<script setup lang="ts">
import pLimit from 'p-limit';
import {
  asRecord,
  isStartupPath,
  parseStartupSummary,
  type StartupSummary,
} from './diagnostic_preview';
import {
  decodeLogText,
  MAX_JSON_SIZE,
  readEntryBytes,
  type LogArchive,
} from './log';
import { isJsonTreeTooLarge } from './json_preview';
import DirectoryPreviewHeader from './DirectoryPreviewHeader.vue';
import LogDiagnosticPreview from './LogDiagnosticPreview.vue';
import JsonPreview from './JsonPreview.vue';
import TextViewer from './text_viewer/TextViewer.vue';

const props = defineProps<{ archive: LogArchive }>();
const items = shallowRef<StartupSummary[]>([]);
const loading = shallowRef(false);
const selected = shallowRef<StartupSummary>();
const detail = shallowRef<{
  raw: string;
  value?: unknown;
  error?: string;
  structured?: boolean;
}>();
const detailLoading = shallowRef(false);
const query = shallowRef(``);
let sequence = 0;
let disposed = false;
const setQuery = (value: string) => {
  query.value = value;
};
const filteredItems = computed(() =>
  items.value.filter((item) =>
    [
      item.path,
      item.time,
      item.process,
      item.version,
      item.device,
      item.storage,
    ].some((value) =>
      value.toLowerCase().includes(query.value.trim().toLowerCase()),
    ),
  ),
);
const columns = [
  { key: `time`, title: `启动时间` },
  { key: `process`, title: `进程` },
  { key: `version`, title: `应用版本` },
  { key: `device`, title: `设备` },
  { key: `storage`, title: `存储位置` },
  { key: `path`, title: `文件` },
  { key: `error`, title: `读取问题` },
];
const loadSummaries = async () => {
  loading.value = true;
  const limit = pLimit(4);
  const results = await Promise.all(
    props.archive.entries
      .filter((entry) => isStartupPath(entry.path))
      .map((entry) =>
        limit(async () => {
          try {
            if (entry.kind != `json`) throw new Error(`不支持的启动记录格式`);
            return parseStartupSummary(
              entry.path,
              decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE)),
            );
          } catch (error) {
            return {
              ...parseStartupSummary(entry.path, `null`),
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      ),
  );
  if (disposed) return;
  items.value = results.sort(
    (a, b) => b.timestamp - a.timestamp || b.path.localeCompare(a.path),
  );
  loading.value = false;
};
const openDetail = async (item: StartupSummary) => {
  const current = ++sequence;
  selected.value = item;
  detail.value = undefined;
  detailLoading.value = true;
  try {
    const entry = props.archive.entryMap.get(item.path);
    if (!entry || entry.kind != `json`) throw new Error(`不支持的启动记录格式`);
    const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
    if (disposed || current != sequence) return;
    try {
      const value: unknown = JSON.parse(raw);
      detail.value = {
        raw,
        value,
        structured:
          Object.keys(asRecord(value)).length > 0 && !isJsonTreeTooLarge(value),
      };
    } catch (error) {
      detail.value = { raw, error: `JSON 解析失败：${String(error)}` };
    }
  } catch (error) {
    if (!disposed && current == sequence)
      detail.value = { raw: ``, error: String(error) };
  } finally {
    if (!disposed && current == sequence) detailLoading.value = false;
  }
};
const showList = () => {
  sequence++;
  selected.value = undefined;
  detail.value = undefined;
  detailLoading.value = false;
};
const rowProps = (item: StartupSummary) => ({
  class: `cursor-pointer`,
  onClick: () => {
    void openDetail(item);
  },
});
const dispose = () => {
  disposed = true;
  sequence++;
};
onMounted(loadSummaries);
onBeforeUnmount(dispose);
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-10px">
    <DirectoryPreviewHeader
      title="启动记录"
      :count="items.length"
      listLabel="启动列表"
      :listActive="!selected"
      :detailText="selected?.path"
      @selectList="showList"
    />
    <NSpin v-if="loading || detailLoading" show class="min-h-0 flex-1" />
    <template v-else-if="!selected">
      <NInput
        :value="query"
        placeholder="搜索时间、进程、版本、设备或文件"
        clearable
        @update:value="setQuery"
      />
      <NDataTable
        :columns="columns"
        :data="filteredItems"
        :rowProps="rowProps"
        :rowKey="(item: StartupSummary) => item.path"
        :pagination="false"
        striped
        class="min-h-0 flex-1 overflow-auto"
      />
    </template>
    <template v-else-if="detail">
      <NAlert v-if="detail.error" type="warning" title="启动记录读取失败">{{
        detail.error
      }}</NAlert>
      <TextViewer
        v-if="detail.error && detail.raw"
        :key="selected.path"
        :value="detail.raw"
        allow-wrap
        copyable
        class="min-h-0 flex-1"
      />
      <LogDiagnosticPreview
        v-else-if="detail.structured"
        :key="selected.path"
        kind="startup"
        :value="detail.value"
        :raw="detail.raw"
        class="min-h-0 flex-1"
      />
      <JsonPreview
        v-else-if="!detail.error"
        :key="selected.path"
        :value="detail.value"
        :raw="detail.raw"
        class="min-h-0 flex-1"
      />
    </template>
  </div>
</template>
