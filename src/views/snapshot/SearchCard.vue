<script setup lang="ts">
import DraggableCard from '@/components/DraggableCard.vue';
import SelectorText from '@/components/SelectorText.vue';
import { message } from '@/utils/discrete';
import { errorTry } from '@/utils/error';
import { getAppInfo, getNodeLabel, getNodeStyle } from '@/utils/node';
import { buildEmptyFn, copy } from '@/utils/others';
import { parseSelector } from '@/utils/selector';
import { gkdWidth, vw } from '@/utils/size';
import { getImagUrl, getImportUrl } from '@/utils/url';
import { FastQuery, GkdException } from '@gkd-kit/selector';
import dayjs from 'dayjs';
import type { ShallowRef } from 'vue';
import JSON5 from 'json5';
import { useSnapshotStore } from './snapshot';
import {
  encodeSnapshotUrlState,
  type SnapshotUrlQuery,
} from './snapshot_url_codec';
import { useSnapshotUrlState } from './snapshot_url_state';

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

const generateRules = errorTry(async (result: SelectorSearchResult) => {
  const imageId = snapshotImageId[snapshot.value.id];
  const importId = snapshotImportId[snapshot.value.id];
  const snapshotUrls = importId ? getImportUrl(importId) : undefined;
  const exampleUrls = imageId ? getImagUrl(imageId) : undefined;

  const s = result.selector;
  const t = result.results.map((v) => v.context.toArray().at(-1)!)[0];

  const fastQuery = [
    (t.quickFind ?? t.idQf) &&
      t.attr.id &&
      s.fastQueryList.some(
        (v) => v instanceof FastQuery.Id && v.acceptText(t.attr.id!),
      ),
    (t.quickFind ?? t.idQf) &&
      t.attr.vid &&
      s.fastQueryList.some(
        (v) => v instanceof FastQuery.Vid && v.acceptText(t.attr.vid!),
      ),
    (t.quickFind ?? t.textQf) &&
      t.attr.text &&
      s.fastQueryList.some(
        (v) => v instanceof FastQuery.Text && v.acceptText(t.attr.text!),
      ),
  ].some(Boolean);
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
    <div bg-white b-1px b-solid b-gray-200 rounded-4px p-8px>
      <div flex m-b-4px pr-4px>
        <NRadioGroup v-model:value="enableSearchBySelector">
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
        class="w-full overflow-hidden rounded-6px border border-[#e5e7eb] bg-white transition-colors duration-200 focus-within:border-[#18a058]"
      >
        <NInput
          v-model:value="searchText"
          class="gkd_code"
          type="textarea"
          :placeholder="enableSearchBySelector ? `请输入选择器` : `请输入字符`"
          :autosize="{ minRows: 1, maxRows: 10 }"
          :bordered="false"
          @keydown="handleSearchKeydown"
        />
        <div class="flex items-center justify-between gap-4px px-6px pb-4px">
          <span class="select-none text-11px leading-22px text-[#94a3b8]">
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
      <NCollapse v-model:expandedNames="expandedKeys">
        <NCollapseItem
          v-for="(result, index) in selectorResults"
          :key="result.key"
          :name="result.key"
        >
          <template #header>
            <span
              v-if="result.nodes.length > 1"
              underline
              leading-20px
              decoration-1
              m-r-4px
              gkd_code
              title="查询数量"
            >
              {{ result.nodes.length }}
            </span>
            <span
              break-all
              px-4px
              leading-20px
              bg="#eee"
              gkd_code
              :title="result.gkd ? `选择器` : `搜索字符`"
            >
              <SelectorText
                v-if="result.gkd"
                :node="result.selector.ast"
                :source="result.selector.source"
              />
              <template v-else>{{ result.selector }}</template>
            </span>
            <span pl-4px />
          </template>
          <template #header-extra>
            <NButtonGroup>
              <NButton
                v-if="result.gkd && result.selector.canCopy"
                size="small"
                title="复制规则"
                @click.stop="generateRules(result as SelectorSearchResult)"
              >
                <template #icon>
                  <SvgIcon name="copy" />
                </template>
              </NButton>
              <NButton
                v-if="hasZipId"
                size="small"
                :title="result.gkd ? `复制查询链接` : `复制搜索链接`"
                @click.stop="shareResult(result)"
              >
                <template #icon>
                  <SvgIcon name="share" />
                </template>
              </NButton>
              <NButton
                size="small"
                title="删除记录"
                @click.stop="deleteResult(index)"
              >
                <template #icon>
                  <SvgIcon name="delete" />
                </template>
              </NButton>
            </NButtonGroup>
          </template>
          <NScrollbar xScrollable style="max-height: 400px">
            <div flex gap-8px flex-wrap>
              <template
                v-if="!result.gkd || result.selector.connectKeys.length === 0"
              >
                <NButton
                  v-for="resultNode in result.nodes"
                  :key="resultNode.id"
                  size="small"
                  :style="getNodeStyle(resultNode, focusNode)"
                  @click="updateFocusNode(resultNode)"
                >
                  {{ getNodeLabel(resultNode) }}
                </NButton>
              </template>
              <template v-else>
                <NButtonGroup v-for="(resultNode, i) in result.nodes" :key="i">
                  <NButton
                    size="small"
                    @click="
                      snapshotStore.showTrack(
                        result.selector,
                        result.results[i],
                      )
                    "
                  >
                    <NIcon>
                      <SvgIcon name="path" />
                    </NIcon>
                  </NButton>
                  <NButton
                    size="small"
                    :style="getNodeStyle(resultNode, focusNode)"
                    @click="updateFocusNode(resultNode)"
                  >
                    {{ getNodeLabel(resultNode) }}
                  </NButton>
                </NButtonGroup>
              </template>
            </div>
            <div un="h-10px" />
          </NScrollbar>
        </NCollapseItem>
      </NCollapse>
    </div>
  </DraggableCard>
</template>
