<script setup lang="ts">
import type { RawNode, Snapshot } from '@/entities/snapshot/types';

import GkSvg from '@/shared/ui/GkSvg.vue';
import GkDraggableCard from '@/shared/ui/GkDraggableCard.vue';
import type { GkDraggableCardValue } from '@/shared/ui/GkDraggableCard.ts';
import { message } from '@/shared/services/feedback';
import { errorTry } from '@/shared/services/error';
import { getAppInfo, getNodeLabel } from '@/entities/snapshot/node';
import { copy } from '@/shared/lib/clipboard';
import { buildEmptyFn } from '@/shared/lib/function';
import { parseSelector } from '@/entities/selector/parser';
import { gkdWidth, vw } from './size';
import { getImagUrl, getImportUrl } from '@/entities/snapshot/urls';
import { useSnapshotMetadataStore } from '@/entities/snapshot/metadataStore';
import { GkdException } from '@gkd-kit/selector';
import type { ShallowRef } from 'vue';
import { useSnapshotStore } from './snapshot';
import {
  encodeSnapshotUrlState,
  type SnapshotUrlQuery,
} from './snapshot_url_codec';
import { useSnapshotUrlState } from './snapshot_url_state';
import type { SearchResult, SelectorSearchResult } from './search_types';
import SelectorSyntaxInput from '@/entities/selector/ui/SelectorSyntaxInput.vue';
import SearchResultList from './SearchResultList.vue';
import SelectorLibraryDialog from '@/features/selector-library/ui/SelectorLibraryDialog.vue';
import RuleComposerDialog from './RuleComposerDialog.vue';
import {
  composeRuleOutput,
  createRuleComposerDefaults,
  type RuleComposerOptions,
  type RuleOutputDepth,
} from './rule_composer';
import { getFastQueryEvidence } from './selector_diagnostics';

const props = withDefaults(
  defineProps<{
    show: boolean;
    layout?: GkDraggableCardValue;
    onUpdateShow?: (data: boolean) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
  },
);
const emit = defineEmits<{
  updateLayout: [value: GkDraggableCardValue];
}>();

const draggableInitialValue = computed(() => ({
  top: 40,
  right: Math.max(315, 12 * vw.value + 135),
  width: Math.max(480, gkdWidth.value * 0.3),
  ...props.layout,
}));
const updateLayout = (value: GkDraggableCardValue) => {
  emit('updateLayout', value);
};

const { snapshotImportId, snapshotImageId } = useSnapshotMetadataStore();

const snapshotStore = useSnapshotStore();
const snapshotUrlState = useSnapshotUrlState();
const snapshot = snapshotStore.snapshot as ShallowRef<Snapshot>;
const rootNode = snapshotStore.rootNode as ShallowRef<RawNode>;
const screenshotUrl = snapshotStore.screenshotUrl;
const { focusNode, updateFocusNode } = snapshotStore;

const searchText = shallowRef(``);

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

const updateSearchText = (value: string) => {
  searchText.value = value;
};

const updateSearchMode = (value: boolean) => {
  enableSearchBySelector.value = value;
};

const selectorLibraryShow = shallowRef(false);
const selectorLibrarySource = shallowRef('');
const openSelectorLibrary = (selector = '') => {
  selectorLibrarySource.value = selector.trim();
  selectorLibraryShow.value = true;
};
const setSelectorLibraryVisible = (visible: boolean) => {
  selectorLibraryShow.value = visible;
};
const useLibrarySelector = (selector: string) => {
  updateSearchMode(true);
  updateSearchText(selector);
  searchBySelector();
};

const getRuleReferences = () => {
  const imageId = snapshotImageId[snapshot.value.id];
  const importId = snapshotImportId[snapshot.value.id];
  return {
    snapshotUrl: importId ? getImportUrl(importId) : undefined,
    exampleUrl: imageId ? getImagUrl(imageId) : undefined,
  };
};
const getRuleComposerOptions = (
  result: SelectorSearchResult,
  outputDepth: RuleOutputDepth,
): RuleComposerOptions => {
  const references = getRuleReferences();
  return {
    ...createRuleComposerDefaults(),
    outputDepth,
    appId: snapshot.value.appId,
    appName: getAppInfo(snapshot.value).name,
    activityId: snapshot.value.activityId,
    selector: result.selector.toString(),
    fastQuery: result.fastQueryEvidence?.status == 'supported',
    ...references,
  };
};
const generateRules = errorTry(async (result: SelectorSearchResult) => {
  await copy(composeRuleOutput(getRuleComposerOptions(result, 'app')));
});
const ruleComposerShow = shallowRef(false);
const ruleComposerResult = shallowRef<SelectorSearchResult>();
const ruleComposerStartedAt = shallowRef(Date.now());
const openRuleComposer = (result: SelectorSearchResult) => {
  ruleComposerResult.value = result;
  ruleComposerStartedAt.value = Date.now();
  ruleComposerShow.value = true;
};
const setRuleComposerVisible = (visible: boolean) => {
  ruleComposerShow.value = visible;
};
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
  <GkDraggableCard
    v-slot="{ onRef }"
    :initialValue="draggableInitialValue"
    :minWidth="300"
    sizeDraggable
    class="box-shadow-dim"
    :show="show"
    @update:value="updateLayout"
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
        <NButton
          class="ml-12px"
          text
          title="选择器库"
          aria-label="选择器库"
          @click="openSelectorLibrary()"
        >
          <template #icon><GkSvg name="selector-library" /></template>
        </NButton>
        <div :ref="onRef" flex-1 cursor-move />
        <NButton text title="最小化" @click="onUpdateShow(!show)">
          <template #icon>
            <GkSvg name="minus" />
          </template>
        </NButton>
      </div>
      <SelectorSyntaxInput
        :value="searchText"
        :placeholder="enableSearchBySelector ? `请输入选择器` : `请输入字符`"
        :validate="enableSearchBySelector"
        hint="Enter 搜索 · Shift+Enter 换行"
        @update:value="updateSearchText"
        @keydown="handleSearchKeydown"
      >
        <template #actions>
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
              <GkSvg name="search" />
            </template>
          </NButton>
        </template>
      </SelectorSyntaxInput>
      <div p-5px />
      <SearchResultList
        :results="selectorResults"
        :expandedKeys="expandedKeys"
        :hasZipId="hasZipId"
        @update:expandedKeys="updateExpandedKeys"
        @composeRules="openRuleComposer"
        @generateRules="generateRules"
        @saveSelector="openSelectorLibrary($event.selector.toString())"
        @share="shareResult"
        @delete="deleteResult"
      />
    </div>
  </GkDraggableCard>
  <SelectorLibraryDialog
    :show="selectorLibraryShow"
    :initialSelector="selectorLibrarySource"
    :appId="snapshot.appId"
    :activityId="snapshot.activityId"
    allowSave
    @use="useLibrarySelector"
    @update:show="setSelectorLibraryVisible"
  />
  <RuleComposerDialog
    :show="ruleComposerShow"
    :snapshot="snapshot"
    :rootNode="rootNode"
    :targetNode="ruleComposerResult?.nodes[0] || rootNode"
    :selector="ruleComposerResult?.selector.toString() || ''"
    :fastQuery="ruleComposerResult?.fastQueryEvidence?.status == 'supported'"
    :startedAt="ruleComposerStartedAt"
    :screenshotUrl="screenshotUrl"
    :exampleUrl="getRuleReferences().exampleUrl"
    :snapshotUrl="getRuleReferences().snapshotUrl"
    @update:show="setRuleComposerVisible"
  />
</template>
