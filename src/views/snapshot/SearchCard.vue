<script setup lang="ts">
import DraggableCard from '@/components/DraggableCard.vue';
import { message } from '@/utils/discrete';
import { errorTry, errorWrap } from '@/utils/error';
import { getAppInfo, getNodeLabel } from '@/utils/node';
import { buildEmptyFn, copy } from '@/utils/others';
import type { GkdSelector } from '@/utils/selector';
import { parseSelector, wasmLoadTask } from '@/utils/selector';
import { gkdWidth, vw } from '@/utils/size';
import type { RawNode, Snapshot } from '@/utils/types';
import { getImagUrl, getImportUrl } from '@/utils/url';
import { SelectorCheckException } from '@gkd-kit/selector';
import dayjs from 'dayjs';
import * as base64url from 'universal-base64url';
import type { ShallowRef } from 'vue';

withDefaults(
  defineProps<{
    show: boolean;
    onUpdateShow?: (data: boolean) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
  },
);

const route = useRoute();
const { snapshotImportId, snapshotImageId } = useStorageStore();

const snapshotStore = useSnapshotStore();
const { updateFocusNode } = snapshotStore;
const snapshotRefs = storeToRefs(snapshotStore);
const snapshot = snapshotRefs.snapshot as ShallowRef<Snapshot>;
const rootNode = snapshotRefs.rootNode as ShallowRef<RawNode>;
const { focusNode, track } = snapshotRefs;

const selectorText = shallowRef(``);
type SearchResult =
  | {
      key: number;
      selector: string;
      nodes: RawNode[];
    }
  | {
      key: number;
      selector: GkdSelector;
      nodes: RawNode[][];
    };
const selectorResults = shallowReactive<SearchResult[]>([]);
const expandedKeys = shallowRef<number[]>([]);
const searchSelector = (text: string) => {
  const selector = errorWrap(
    () => parseSelector(text),
    (e) => {
      if (typeof e == 'string') {
        return e;
      }
      if (e instanceof Error && e.cause instanceof SelectorCheckException) {
        return e.message;
      }
      return `非法选择器`;
    },
  );
  if (
    selectorResults.find(
      (s) =>
        typeof s.selector == 'object' &&
        s.selector.toString() == selector.toString(),
    )
  ) {
    message.warning(`不可重复选择`);
    return;
  }

  const results = selector.querySelectorTrackAll(rootNode.value);
  if (results.length == 0) {
    message.success(`没有选择到节点`);
    return;
  }
  message.success(`选择到 ${results.length} 个节点`);
  selectorResults.unshift({ selector, nodes: results, key: Date.now() });
  return results.length;
};
const searchString = (text: string) => {
  if (
    selectorResults.find(
      (s) => typeof s.selector == 'string' && s.selector.toString() == text,
    )
  ) {
    message.warning(`不可重复搜索`);
    return;
  }
  const results: RawNode[] = [];
  const stack: RawNode[] = [rootNode.value];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (getNodeLabel(n).includes(text)) {
      results.push(n);
    }
    stack.push(...[...n.children].reverse());
  }
  if (results.length == 0) {
    message.success(`没有搜索到节点`);
    return;
  }
  message.success(`搜索到 ${results.length} 个节点`);
  selectorResults.unshift({
    selector: text,
    nodes: results,
    key: Date.now(),
  });
  return results.length;
};
const refreshExpandedKeys = () => {
  const newResult = selectorResults[0];
  const newNode = newResult.nodes[0];
  if (!Array.isArray(newNode)) {
    updateFocusNode(newNode);
  } else if (typeof newResult.selector == 'object' && Array.isArray(newNode)) {
    updateFocusNode(newNode[newResult.selector.targetIndex]);
  }
  const allKeys = new Set(selectorResults.map((s) => s.key));
  const newKeys = expandedKeys.value.filter((k) => allKeys.has(k));
  newKeys.push(newResult.key);
  expandedKeys.value = newKeys;
};
const searchBySelector = errorTry(() => {
  const text = selectorText.value.trim();
  if (!text) return;
  if (enableSearchBySelector.value) {
    if (!searchSelector(text)) return;
  } else {
    if (!searchString(text)) return;
  }
  refreshExpandedKeys();
});

onMounted(async () => {
  await wasmLoadTask;
  let count = 0;
  if (route.query.gkd) {
    count += searchSelector(base64url.decode(route.query.gkd as string)) || 0;
  }
  if (route.query.str) {
    count += searchString(route.query.str as string) || 0;
  }
  if (count > 0) {
    refreshExpandedKeys();
  }
});

const generateRules = errorTry(
  async (result: {
    key: number;
    selector: GkdSelector;
    nodes: RawNode[][];
  }) => {
    const imageId = snapshotImageId[snapshot.value.id];
    const importId = snapshotImportId[snapshot.value.id];
    const zipUrl = importId ? getImportUrl(importId) : undefined;

    const s = result.selector;
    const t = result.nodes[0].at(-1)!;

    const quickFind = [
      (t.quickFind ?? t.idQf) && t.attr.id && s.qfIdValue,
      (t.quickFind ?? t.idQf) && t.attr.vid && s.qfVidValue,
      (t.quickFind ?? t.textQf) && t.attr.text && s.qfTextValue,
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
              quickFind: quickFind || undefined,
              activityIds: snapshot.value.activityId,
              matches: s.toString(),
              exampleUrls: getImagUrl(imageId),
              snapshotUrls: zipUrl,
            },
          ],
        },
      ],
    };

    copy(JSON5.stringify(rule, undefined, 2));
  },
);
const enableSearchBySelector = shallowRef(true);
const hasZipId = computed(() => {
  return snapshotImportId[snapshot.value.id];
});
const shareResult = (result: SearchResult) => {
  if (!hasZipId.value) return;
  const importUrl = new URL(getImportUrl(snapshotImportId[snapshot.value.id]));
  if (typeof result.selector == 'object') {
    importUrl.searchParams.set(
      'gkd',
      base64url.encode(result.selector.toString()),
    );
  } else {
    importUrl.searchParams.set('str', result.selector.toString());
  }
  copy(importUrl.toString());
};
</script>
<template>
  <DraggableCard
    :initialValue="{
      top: 40,
      right: Math.max(315, 12 * vw + 135),
      width: Math.max(480, gkdWidth * 0.3),
    }"
    :minWidth="300"
    sizeDraggable
    v-slot="{ onRef }"
    class="z-1 box-shadow-dim"
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
        <div flex-1 cursor-move :ref="onRef"></div>
        <NButton @click="onUpdateShow(!show)" text title="最小化">
          <template #icon>
            <NIcon>
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 13v-2h12v2z" />
              </svg>
            </NIcon>
          </template>
        </NButton>
      </div>
      <NInputGroup>
        <NInput
          v-model:value="selectorText"
          :placeholder="enableSearchBySelector ? `请输入选择器` : `请输入字符`"
          @keyup.enter="searchBySelector"
          :inputProps="{ class: 'gkd_code' }"
        ></NInput>
        <NButton @click="searchBySelector">
          <template #icon>
            <NIcon>
              <svg viewBox="0 0 32 32">
                <path
                  d="M29 27.586l-7.552-7.552a11.018 11.018 0 1 0-1.414 1.414L27.586 29zM4 13a9 9 0 1 1 9 9a9.01 9.01 0 0 1-9-9z"
                  fill="currentColor"
                ></path>
              </svg>
            </NIcon>
          </template>
        </NButton>
      </NInputGroup>
      <div p-5px></div>
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
              decoration-1
              m-r-4px
              title="查询数量"
            >
              {{ result.nodes.length }}
            </span>
            <span
              break-all
              :title="
                typeof result.selector == 'object' ? `选择器` : `搜索字符`
              "
            >
              {{ result.selector.toString() }}
            </span>
          </template>
          <template #header-extra>
            <NButton
              size="small"
              v-if="
                typeof result.selector == 'object' && result.selector.canCopy
              "
              @click.stop="
                // @ts-ignore
                generateRules(result)
              "
              title="复制规则"
            >
              <template #icon>
                <NIcon>
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </NIcon>
              </template>
            </NButton>
            <div p-l-4px></div>
            <NButton
              v-if="hasZipId"
              size="small"
              :title="
                typeof result.selector == 'object'
                  ? `复制查询链接`
                  : `复制搜索链接`
              "
              @click.stop="shareResult(result)"
            >
              <template #icon>
                <NIcon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81c1.66 0 3-1.34 3-3s-1.34-3-3-3s-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65c0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </NIcon>
              </template>
            </NButton>
            <div p-l-4px></div>
            <NButton
              size="small"
              @click.stop="selectorResults.splice(index, 1)"
              title="删除记录"
            >
              <template #icon>
                <NIcon>
                  <svg viewBox="0 0 24 24">
                    <g fill="none">
                      <path
                        d="M12 1.75a3.25 3.25 0 0 1 3.245 3.066L15.25 5h5.25a.75.75 0 0 1 .102 1.493L20.5 6.5h-.796l-1.28 13.02a2.75 2.75 0 0 1-2.561 2.474l-.176.006H8.313a2.75 2.75 0 0 1-2.714-2.307l-.023-.174L4.295 6.5H3.5a.75.75 0 0 1-.743-.648L2.75 5.75a.75.75 0 0 1 .648-.743L3.5 5h5.25A3.25 3.25 0 0 1 12 1.75zm6.197 4.75H5.802l1.267 12.872a1.25 1.25 0 0 0 1.117 1.122l.127.006h7.374c.6 0 1.109-.425 1.225-1.002l.02-.126L18.196 6.5zM13.75 9.25a.75.75 0 0 1 .743.648L14.5 10v7a.75.75 0 0 1-1.493.102L13 17v-7a.75.75 0 0 1 .75-.75zm-3.5 0a.75.75 0 0 1 .743.648L11 10v7a.75.75 0 0 1-1.493.102L9.5 17v-7a.75.75 0 0 1 .75-.75zm1.75-6a1.75 1.75 0 0 0-1.744 1.606L10.25 5h3.5A1.75 1.75 0 0 0 12 3.25z"
                        fill="currentColor"
                      ></path>
                    </g></svg
                ></NIcon>
              </template>
            </NButton>
          </template>
          <NSpace
            style="max-height: 400px; overflow-y: scroll; padding-bottom: 10px"
          >
            <template
              v-if="
                typeof result.selector == 'string' ||
                result.selector.connectKeys.length === 0
              "
            >
              <NButton
                v-for="resultNode in result.nodes.map((r) =>
                  Array.isArray(r) ? r[0] : r,
                )"
                :key="resultNode.id"
                @click="updateFocusNode(resultNode)"
                size="small"
                :style="{
                  color: resultNode === focusNode ? '#00F' : undefined,
                }"
              >
                {{ getNodeLabel(resultNode) }}
              </NButton>
            </template>
            <template v-else>
              <NButtonGroup
                v-for="(trackNodes, index) in result.nodes.map((r) =>
                  Array.isArray(r) ? r : [r],
                )"
                :key="index"
              >
                <NButton
                  size="small"
                  @click="
                    track = {
                      nodes: trackNodes,
                      selector: result.selector,
                    }
                  "
                >
                  <NIcon>
                    <svg viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M5 21V8.825Q4.125 8.5 3.563 7.738T3 6q0-1.25.875-2.125T6 3q1.25 0 2.125.875T9 6q0 .975-.562 1.738T7 8.825V19h4V3h8v12.175q.875.325 1.438 1.088T21 18q0 1.25-.875 2.125T18 21q-1.25 0-2.125-.875T15 18q0-.975.563-1.75T17 15.175V5h-4v16zM6 7q.425 0 .713-.288T7 6q0-.425-.288-.712T6 5q-.425 0-.712.288T5 6q0 .425.288.713T6 7m12 12q.425 0 .713-.288T19 18q0-.425-.288-.712T18 17q-.425 0-.712.288T17 18q0 .425.288.713T18 19m0-1"
                      />
                    </svg>
                  </NIcon>
                </NButton>
                <NButton
                  @click="
                    updateFocusNode(trackNodes[result.selector.targetIndex])
                  "
                  size="small"
                  :style="{
                    color:
                      trackNodes[result.selector.targetIndex] === focusNode
                        ? '#00F'
                        : undefined,
                  }"
                >
                  {{ getNodeLabel(trackNodes[result.selector.targetIndex]) }}
                </NButton>
              </NButtonGroup>
            </template>
          </NSpace>
        </NCollapseItem>
      </NCollapse>
    </div>
  </DraggableCard>
</template>
