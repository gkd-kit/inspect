<script lang="tsx" setup>
import { NButton } from 'naive-ui';
import type { PropType } from 'vue';
import JsonBasicTable from './JsonBasicTable.vue';
import {
  getBasicJsonTableRows,
  getJsonEntryCount,
  isJsonStructureTooLarge,
  isJsonTreeTooLarge,
  MAX_STRUCTURED_JSON_ENTRIES,
} from './json_preview';
import RawJsonPreview from './RawJsonPreview.vue';
import TextSearchInput from './TextSearchInput.vue';
import { createTextSearchOptions, matchesTextSearch } from './text_search';

const props = defineProps<{
  value: unknown;
  raw: string;
}>();

const structureTooLarge = computed(() => isJsonTreeTooLarge(props.value));

const getSummary = (value: unknown) => {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value && typeof value == `object`) {
    const count = getJsonEntryCount(value);
    return count == null
      ? `Object(>${MAX_STRUCTURED_JSON_ENTRIES})`
      : `Object(${count})`;
  }
  if (typeof value == `string`) return JSON.stringify(value);
  return String(value);
};

const JsonNode = defineComponent({
  name: `JsonNode`,
  props: {
    value: { type: null as unknown as PropType<unknown>, required: true },
    name: { type: String, required: true },
    depth: { type: Number, default: 0 },
  },
  setup(nodeProps) {
    const expanded = ref(nodeProps.depth == 0);
    return () => {
      const oversized = isJsonStructureTooLarge(nodeProps.value);
      const expandable =
        nodeProps.value != null &&
        typeof nodeProps.value == `object` &&
        !oversized;
      const entries = expandable
        ? Object.entries(nodeProps.value as Record<string, unknown>)
        : [];
      const tableRows = expandable
        ? getBasicJsonTableRows(nodeProps.value)
        : undefined;
      return (
        <div {...{ name: `json-node` }} class="block">
          <div
            {...{ name: `json-node-line` }}
            class="min-h-28px flex items-center gap-6px"
          >
            {expandable ? (
              <NButton
                quaternary
                size="tiny"
                class="w-24px min-w-24px font-inherit"
                onClick={() => (expanded.value = !expanded.value)}
              >
                {expanded.value ? `−` : `+`}
              </NButton>
            ) : (
              <span class="inline-block w-24px" />
            )}
            <span class="text-[#7c3aed]">{nodeProps.name}</span>
            <span class="text-[#6b7280]">:</span>
            <span
              class={
                expandable
                  ? `text-[#6b7280]`
                  : `text-[#0f766e] [overflow-wrap:anywhere]`
              }
            >
              {getSummary(nodeProps.value)}
            </span>
            {oversized ? (
              <span class="text-[#b45309]">
                结构过大，请切换到原始 JSON 查看
              </span>
            ) : null}
          </div>
          {expandable && expanded.value ? (
            <div
              {...{ name: `json-children` }}
              class="ml-15px border-l border-[#e5e7eb] pl-10px"
            >
              {tableRows ? (
                <JsonBasicTable
                  rows={tableRows}
                  indexed={Array.isArray(nodeProps.value)}
                />
              ) : (
                entries.map(([key, value]) => (
                  <JsonNode
                    key={key}
                    name={key}
                    value={value}
                    depth={nodeProps.depth + 1}
                  />
                ))
              )}
            </div>
          ) : null}
        </div>
      );
    };
  },
});

type SearchResult = { path: string; value: string };
const query = shallowRef(``);
const searchOptions = reactive(createTextSearchOptions());
const searchResults = computed<SearchResult[]>(() => {
  const actualQuery = query.value.trim();
  if (!actualQuery || structureTooLarge.value) return [];
  const results: SearchResult[] = [];
  const pending: Array<{ value: unknown; path: string }> = [
    { value: props.value, path: `` },
  ];
  while (pending.length && results.length < 200) {
    const current = pending.pop();
    if (!current) break;
    const { value, path } = current;
    if (value != null && typeof value == `object`) {
      if (isJsonStructureTooLarge(value)) continue;
      const entries = Object.entries(value);
      for (let index = entries.length - 1; index >= 0; index--) {
        const [key, child] = entries[index];
        const childPath = path ? `${path}.${key}` : key;
        if (matchesTextSearch(key, actualQuery, searchOptions)) {
          results.push({ path: childPath, value: getSummary(child) });
          if (results.length >= 200) break;
        }
        pending.push({ value: child, path: childPath });
      }
      continue;
    }
    const text = getSummary(value);
    if (matchesTextSearch(text, actualQuery, searchOptions)) {
      results.push({ path: path || `$`, value: text });
    }
  }
  return results;
});
</script>

<template>
  <NTabs
    type="line"
    animated
    class="h-full [&_.n-tab-pane]:h-full [&_.n-tab-pane]:min-h-0 [&_.n-tabs-pane-wrapper]:h-full [&_.n-tabs-pane-wrapper]:min-h-0"
  >
    <NTabPane name="structured" tab="结构化">
      <div flex flex-col gap-10px h-full>
        <TextSearchInput
          v-model="query"
          v-model:match-case="searchOptions.matchCase"
          v-model:whole-word="searchOptions.wholeWord"
          v-model:use-regex="searchOptions.useRegex"
          placeholder="搜索键或值，最多展示 200 条结果"
        />
        <div
          name="json-structure-scroll"
          class="min-h-0 flex-1 overflow-auto px-4px pb-24px pt-8px font-mono text-13px"
        >
          <NAlert v-if="structureTooLarge" type="warning" title="JSON 结构过大">
            为避免占用过多内存，请切换到“原始 JSON”查看和搜索。
          </NAlert>
          <template v-else-if="query.trim()">
            <NEmpty v-if="searchResults.length == 0" description="没有匹配项" />
            <div
              v-else
              name="json-search-results"
              class="flex flex-col gap-6px"
            >
              <div
                v-for="item in searchResults"
                :key="`${item.path}:${item.value}`"
                name="json-search-item"
                class="rounded-4px border border-[#e5e7eb] px-10px py-8px"
              >
                <div class="text-[#7c3aed]">{{ item.path }}</div>
                <div class="mt-4px text-[#374151] [overflow-wrap:anywhere]">
                  {{ item.value }}
                </div>
              </div>
            </div>
          </template>
          <JsonNode v-else name="$" :value="value" :depth="0" />
        </div>
      </div>
    </NTabPane>
    <NTabPane name="raw" tab="原始 JSON">
      <RawJsonPreview :value="value" :raw="raw" />
    </NTabPane>
  </NTabs>
</template>
