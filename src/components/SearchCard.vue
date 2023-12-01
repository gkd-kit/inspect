<script setup lang="ts">
import dayjs from 'dayjs';
import { message } from '@/utils/discrete';
import { errorTry, errorWrap } from '@/utils/error';
import { parseSelector } from '@/utils/selector';
import type { Selector } from '@/utils/selector';
import type { RawNode, Snapshot } from '@/utils/types';
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NInput,
  NInputGroup,
  NRadio,
  NRadioGroup,
  NSpace,
  NIcon,
} from 'naive-ui';
import { shallowReactive, shallowRef } from 'vue';
import DraggableCard from './DraggableCard.vue';
import { getNodeLabel } from '@/utils/node';
import { copy } from '@/utils/others';
import { githubJpgStorage, githubZipStorage } from '@/utils/storage';
import { githubUrlToSelfUrl } from '@/utils/url';
import JSON5 from 'json5';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    rootNode: RawNode;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {
    onUpdateFocusNode: () => () => {},
  },
);

const selectorText = shallowRef(``);
const selectorResults = shallowReactive<
  {
    selector: string | Selector;

    results: RawNode[];
  }[]
>([]);
const searchBySelector = errorTry(() => {
  if (!props.rootNode) {
    message.error(`根节点不存在`);
    return;
  }
  const text = selectorText.value.trim();
  if (!text) return;

  if (enableSearchBySelector.value) {
    const selector = errorWrap(() => parseSelector(text), `选择器非法`);
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

    const results = selector.querySelectorAll(props.rootNode);
    if (results.length == 0) {
      message.success(`没有选择到节点`);
      return;
    }
    message.success(`选择到 ${results.length} 个节点`);
    selectorResults.unshift({ selector, results });
  } else {
    if (
      selectorResults.find(
        (s) => typeof s.selector == 'string' && s.selector.toString() == text,
      )
    ) {
      message.warning(`不可重复选择`);
      return;
    }
    const results: RawNode[] = [];
    const stack: RawNode[] = [props.rootNode];
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
    selectorResults.unshift({ selector: text, results });
  }
});
const generateRules = errorTry(async (selector: Selector) => {
  let jpgUrl = githubJpgStorage[props.snapshot.id];
  if (jpgUrl) {
    jpgUrl = githubUrlToSelfUrl(jpgUrl);
  }
  let zipUrl = githubZipStorage[props.snapshot.id];
  if (zipUrl) {
    zipUrl = githubUrlToSelfUrl(zipUrl);
  }

  const rule = {
    id: props.snapshot.appId,
    name: props.snapshot.appName,
    groups: [
      {
        key: 1,
        name: `[ChangeMe]规则名称-${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
        desc: `[ChangeMe]本规则由GKD网页端审查工具生成`,
        rules: [
          {
            activityIds: props.snapshot.activityId,
            matches: selector.toString(),
            exampleUrls: jpgUrl,
            snapshotUrls: zipUrl,
          },
        ],
      },
    ],
  };

  copy(JSON5.stringify(rule, undefined, 2));
});
const enableSearchBySelector = shallowRef(true);
const _1vw = window.innerWidth / 100;
</script>
<template>
  <DraggableCard
    :initialValue="{ top: 75, right: Math.max(315, 12 * _1vw + 135) }"
    v-slot="{ onRef }"
    class="z-1"
  >
    <div
      w-480px
      bg-white
      b-1px
      b-solid
      b-gray-200
      rounded-4px
      p-8px
      style="min-width: max(25vw, 480px)"
    >
      <div flex m-b-4px>
        <NRadioGroup v-model:value="enableSearchBySelector">
          <NSpace>
            <NRadio :value="false"> 字符搜索 </NRadio>
            <NRadio :value="true"> 选择器查询 </NRadio>
          </NSpace>
        </NRadioGroup>
        <div flex-1 cursor-move :ref="onRef"></div>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 32 32"
              >
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
      <NCollapse>
        <NCollapseItem
          v-for="(selectorResult, index) in selectorResults"
          :key="selectorResult.selector.toString()"
        >
          <template #header>
            <span v-if="selectorResult.results.length > 1" underline decoration-1 m-r-4px title="查询数量">
              {{ selectorResult.results.length }}
            </span>
            <span break-all title="选择器">
              {{ selectorResult.selector.toString() }}
            </span>
          </template>
          <template #header-extra>
            <NButton
              size="small"
              v-if="typeof selectorResult.selector == 'object'"
              @click.stop="generateRules(selectorResult.selector as Selector)"
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
            <div p-l-8px></div>
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
            <NButton
              v-for="resultNode in selectorResult.results"
              :key="resultNode.id"
              @click="onUpdateFocusNode(resultNode)"
              size="small"
            >
              {{ getNodeLabel(resultNode) }}
            </NButton>
          </NSpace>
        </NCollapseItem>
      </NCollapse>
    </div>
  </DraggableCard>
</template>
