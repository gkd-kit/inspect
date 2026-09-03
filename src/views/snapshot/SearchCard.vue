<script setup lang="ts">
import DraggableCard from '@/components/base/DraggableCard.vue';
import { message } from '@/utils/discrete';
import { errorTry } from '@/utils/error';
import { getAppInfo, getNodeLabel } from '@/domain/snapshot/node';
import { buildEmptyFn, copy } from '@/utils/others';
import { parseSelector } from '@/domain/selector/parser';
import { gkdWidth, vw } from './size';
import { getImagUrl, getImportUrl } from '@/utils/url';
import { GkdException } from '@gkd-kit/selector';
import dayjs from 'dayjs';
import type { ShallowRef } from 'vue';
import JSON5 from 'json5';
import { useSnapshotStore } from './snapshot';
import {
  encodeSnapshotUrlState,
  type SnapshotUrlQuery,
} from './snapshot_url_codec';
import { useSnapshotUrlState } from './snapshot_url_state';
import type { SearchResult, SelectorSearchResult } from './search_types';
import SelectorSyntaxDiagnostic from './SelectorSyntaxDiagnostic.vue';
import SelectorSyntaxInput from './SelectorSyntaxInput.vue';
import SearchResultList from './SearchResultList.vue';
import {
  getFastQueryEvidence,
  inspectSelectorSyntax,
  type SelectorSyntaxDiagnostic as SelectorSyntaxDiagnosticValue,
} from './selector_diagnostics';

withDefaults(
  defineProps<{
    show: boolean;
    onUpdateShow?: (data: boolean) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
  },
);

const { snapshotImportId, snapshotImageId } = useStorageStore();

const snapshotStore = useSnapshotStore();
const snapshotUrlState = useSnapshotUrlState();
const snapshot = snapshotStore.snapshot as ShallowRef<Snapshot>;
const rootNode = snapshotStore.rootNode as ShallowRef<RawNode>;
const { focusNode, updateFocusNode } = snapshotStore;

const searchText = shallowRef(``);
const selectorSyntax = shallowRef<SelectorSyntaxDiagnosticValue>({
  status: 'empty',
});

const selectorResults = shallowReactive<SearchResult[]>([]);
const expandedKeys = shallowRef<number[]>([]);
let nextResultKey = Date.now();
const getNextResultKey = () => nextResultKey++;

const getSelectorError = (error: unknown): string => {
  if (typeof error == 'string') {
    return error;
  }
  if (error instanceof GkdException) {
    return `非法选择器:` + error.outMessage;
  }
  return (
    `非法选择器:` + (error instanceof Error ? error.message : String(error))
  );
};

const searchSelector = (text: string, notify = true) => {
  let selector;
  try {
    selector = parseSelector(text);
  } catch (error) {
    if (notify) {
      message.error(getSelectorError(error));
    }
    return;
  }
  if (
    selectorResults.find(
      (result) =>
        typeof result.selector == 'object' &&
        result.selector.toString() == selector.toString(),
    )
  ) {
    if (notify) {
      message.warning(`不可重复选择`);
    }
    return;
  }

  const results = selector.querySelfOrSelectorAllContext(rootNode.value);
  if (results.length == 0) {
    if (notify) {
      message.success(`没有选择到节点`);
    }
    return;
  }
  if (notify) {
    message.success(`选择到 ${results.length} 个节点`);
  }
  selectorResults.unshift({
    selector,
    nodes: results.map((result) => result.target),
    results,
    key: getNextResultKey(),
    gkd: true,
    fastQueryEvidence: getFastQueryEvidence(selector, results),
  });
  return results.length;
};
const searchString = (text: string, notify = true) => {
  if (
    selectorResults.find(
      (result) => typeof result.selector == 'string' && result.selector == text,
    )
  ) {
    if (notify) {
      message.warning(`不可重复搜索`);
    }
    return;
  }
  const results: RawNode[] = [];
  const stack: RawNode[] = [rootNode.value];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (getNodeLabel(node).includes(text)) {
      results.push(node);
    }
    stack.push(...[...node.children].reverse());
  }
  if (results.length == 0) {
    if (notify) {
      message.success(`没有搜索到节点`);
    }
    return;
  }
  if (notify) {
    message.success(`搜索到 ${results.length} 个节点`);
  }
  selectorResults.unshift({
    gkd: false,
    selector: text,
    nodes: results,
    key: getNextResultKey(),
  });
  return results.length;
};

const getResultQuery = (result: SearchResult): SnapshotUrlQuery => ({
  type: result.gkd ? 'selector' : 'text',
  value: result.selector.toString(),
});
const getResultQueries = () => selectorResults.map(getResultQuery);
const syncQueryHistory = () => {
  snapshotUrlState.setQueries(getResultQueries());
};

const restoreQueryHistory = () => {
  if (!snapshotUrlState.ready.value || !rootNode.value) return;
  for (const query of [
    ...(snapshotUrlState.state.value.queries ?? []),
  ].reverse()) {
    if (query.type == 'selector') {
      searchSelector(query.value, false);
    } else {
      searchString(query.value, false);
    }
  }
  if (selectorResults[0]) expandedKeys.value = [selectorResults[0].key];
};
restoreQueryHistory();
const refreshExpandedKeys = () => {
  const newResult = selectorResults[0];
  const newNode = newResult.nodes[0];
  if (!Array.isArray(newNode)) {
    updateFocusNode(newNode);
  } else if (typeof newResult.selector == 'object') {
    updateFocusNode(newNode);
  }
  const allKeys = new Set(selectorResults.map((s) => s.key));
  const newKeys = expandedKeys.value.filter((k) => allKeys.has(k));
  newKeys.push(newResult.key);
  expandedKeys.value = newKeys;
};
const searchBySelector = errorTry(() => {
  const text = searchText.value.trim();
  if (!text) return;
  if (enableSearchBySelector.value) {
    if (!searchSelector(text)) return;
  } else {
    if (!searchString(text)) return;
  }
  refreshExpandedKeys();
  syncQueryHistory();
});
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key != 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  searchBySelector();
};

let selectorSyntaxRevision = 0;
const runSelectorSyntaxDiagnostic = (value: string, revision: number) => {
  if (
    revision != selectorSyntaxRevision ||
    searchText.value != value ||
    !enableSearchBySelector.value ||
    !value.trim()
  ) {
    return;
  }
  const diagnostic = inspectSelectorSyntax(value);
  selectorSyntax.value =
    diagnostic.status == 'invalid' ? diagnostic : { status: 'empty' };
};
const runSelectorSyntaxDiagnosticDebounced = useDebounceFn(
  runSelectorSyntaxDiagnostic,
  300,
);
const scheduleSelectorSyntaxDiagnostic = (value: string) => {
  const revision = ++selectorSyntaxRevision;
  selectorSyntax.value = { status: 'empty' };
  if (!enableSearchBySelector.value || !value.trim()) return;
  void runSelectorSyntaxDiagnosticDebounced(value, revision);
};

const updateSearchText = (value: string) => {
  searchText.value = value;
  scheduleSelectorSyntaxDiagnostic(value);
};

const updateSearchMode = (value: boolean) => {
  enableSearchBySelector.value = value;
  scheduleSelectorSyntaxDiagnostic(searchText.value);
};

const generateRules = errorTry(async (result: SelectorSearchResult) => {
  const imageId = snapshotImageId[snapshot.value.id];
  const importId = snapshotImportId[snapshot.value.id];
  const snapshotUrls = importId ? getImportUrl(importId) : undefined;
  const exampleUrls = imageId ? getImagUrl(imageId) : undefined;

  const s = result.selector;
  const fastQuery = result.fastQueryEvidence?.status == 'supported';
  const rule = {
    id: snapshot.value.appId,
    name: getAppInfo(snapshot.value).name,
    groups: [
      {
        key: 1,
        name: `[ChangeMe]规则名称-${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
        desc: `[ChangeMe]本规则由GKD网页端审查工具生成`,
        rules: [
          {
            fastQuery: fastQuery || undefined,
            activityIds: snapshot.value.activityId,
            matches: s.toString(),
            exampleUrls,
            snapshotUrls,
          },
        ],
      },
    ],
  };

  copy(JSON5.stringify(rule, undefined, 2));
});
const enableSearchBySelector = shallowRef(true);
const hasZipId = computed(() => {
  return snapshotImportId[snapshot.value.id];
});
const shareResult = async (result: SearchResult) => {
  if (!hasZipId.value) return;
  try {
    const importUrl = new URL(
      getImportUrl(snapshotImportId[snapshot.value.id]),
    );
    importUrl.searchParams.set(
      'state',
      await encodeSnapshotUrlState({
        focusNodeId:
          focusNode.value?.id == rootNode.value.id
            ? undefined
            : focusNode.value?.id,
        queries: [getResultQuery(result)],
      }),
    );
    await copy(importUrl.toString());
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
};
const deleteResult = (index: number) => {
  const [deletedResult] = selectorResults.splice(index, 1);
  if (deletedResult) {
    expandedKeys.value = expandedKeys.value.filter(
      (key) => key != deletedResult.key,
    );
    syncQueryHistory();
  }
};
const updateExpandedKeys = (keys: number[]) => {
  expandedKeys.value = keys;
};
</script>
<template>
  <DraggableCard
    v-slot="{ onRef }"
    :initialValue="{
      top: 40,
      right: Math.max(315, 12 * vw + 135),
      width: Math.max(480, gkdWidth * 0.3),
    }"
    :minWidth="300"
    sizeDraggable
    class="box-shadow-dim"
    :show="show"
  >
    <div class="app-panel" b-1px b-solid rounded-4px p-8px>
      <div flex m-b-4px pr-4px>
        <NRadioGroup
          :value="enableSearchBySelector"
          @update:value="updateSearchMode"
        >
          <NSpace>
            <NRadio :value="false"> 字符搜索 </NRadio>
            <NRadio :value="true"> 选择器查询 </NRadio>
          </NSpace>
        </NRadioGroup>
        <div :ref="onRef" flex-1 cursor-move />
        <NButton text title="最小化" @click="onUpdateShow(!show)">
          <template #icon>
            <SvgIcon name="minus" />
          </template>
        </NButton>
      </div>
      <div
        class="app-panel w-full overflow-hidden rounded-6px border transition-colors duration-200 focus-within:border-[#18a058]"
      >
        <SelectorSyntaxInput
          :value="searchText"
          :placeholder="enableSearchBySelector ? `请输入选择器` : `请输入字符`"
          :diagnostic="selectorSyntax"
          @update:value="updateSearchText"
          @keydown="handleSearchKeydown"
        />
        <div
          class="min-h-22px flex items-center justify-between gap-4px px-6px pb-4px"
        >
          <SelectorSyntaxDiagnostic
            v-if="enableSearchBySelector && selectorSyntax.status == 'invalid'"
            :diagnostic="selectorSyntax"
          />
          <span
            v-else
            class="select-none text-11px leading-22px text-[#94a3b8]"
          >
            Enter 搜索 · Shift+Enter 换行
          </span>
          <NButton
            circle
            type="primary"
            secondary
            size="tiny"
            title="搜索"
            aria-label="搜索"
            @click="searchBySelector"
          >
            <template #icon>
              <SvgIcon name="search" />
            </template>
          </NButton>
        </div>
      </div>
      <div p-5px />
      <SearchResultList
        :results="selectorResults"
        :expandedKeys="expandedKeys"
        :hasZipId="hasZipId"
        @update:expandedKeys="updateExpandedKeys"
        @generateRules="generateRules"
        @share="shareResult"
        @delete="deleteResult"
      />
    </div>
  </DraggableCard>
</template>
