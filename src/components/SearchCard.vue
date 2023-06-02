<script setup lang="ts">
import { Selector } from '@/selector_core';
import { message } from '@/utils/discrete';
import { errorTry, errorWrap } from '@/utils/error';
import { NodeOption } from '@/utils/selector';
import type { NaiveNode } from '@/utils/types';
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NInput,
  NInputGroup,
  NRadio,
  NRadioGroup,
  NSpace,
} from 'naive-ui';
import { computed, shallowReactive, shallowRef } from 'vue';
import DraggableCard from './DraggableCard.vue';

const props = withDefaults(
  defineProps<{
    root: NaiveNode;
  }>(),
  {},
);
const emit = defineEmits<{
  (e: 'update:focusNode', data: NaiveNode): void;
}>();

const nodeOption = computed(() => {
  if (!props.root) return;
  return new NodeOption(props.root);
});
const selectorText = shallowRef(``);
const selectorResults = shallowReactive<
  {
    selector: string | Selector;

    results: NaiveNode[];
  }[]
>([]);
const searchBySelector = errorTry(() => {
  if (!nodeOption.value || !props.root) {
    message.error(`根节点不存在`);
    return;
  }
  const text = selectorText.value.trim();
  if (!text) return;

  if (enableSearchBySelector.value) {
    if (
      selectorResults.find(
        (s) => typeof s.selector == 'object' && s.selector.toString() == text,
      )
    ) {
      message.warning(`不可重复选择`);
      return;
    }
    const selector = errorWrap(() => Selector.parse(text), `选择器非法`);
    const results = nodeOption.value
      .querySelectorAll(selector)
      .map((s) => s.value)
      .toList();
    if (results.length == 0) {
      message.success(`没有选择到节点`);
      return;
    }
    message.success(`选择到 ${results.length} 个节点`);
    selectorResults.push({ selector, results });
  } else {
    if (
      selectorResults.find(
        (s) => typeof s.selector == 'string' && s.selector.toString() == text,
      )
    ) {
      message.warning(`不可重复选择`);
      return;
    }
    const results: NaiveNode[] = [];
    const stack: NaiveNode[] = [props.root];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.label.includes(text)) {
        results.push(n);
      }
      stack.push(...[...n.children].reverse());
    }
    if (results.length == 0) {
      message.success(`没有搜索到节点`);
      return;
    }
    message.success(`搜索到 ${results.length} 个节点`);
    selectorResults.push({ selector: text, results });
  }
});
const enableSearchBySelector = shallowRef(false);
</script>
<template>
  <DraggableCard
    :initial-value="{ top: 90, right: 380 }"
    v-slot="{ onRef }"
    class="z-1"
  >
    <div w-500px bg-white b-1px b-solid b-gray-200 rounded-4px p-8px>
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
          placeholder="请输入选择器"
          @keyup.enter="searchBySelector"
        ></NInput>
        <NButton @click="searchBySelector">
          {{ enableSearchBySelector ? `查询` : `搜索` }}
        </NButton>
      </NInputGroup>
      <div p-5px></div>
      <NCollapse>
        <NCollapseItem
          v-for="(selectorResult, index) in selectorResults"
          :key="selectorResult.selector.toString()"
          :title="
            (typeof selectorResult.selector == 'string'
              ? `字符搜索`
              : `选择器查询`) +
            `：` +
            selectorResult.selector.toString()
          "
        >
          <template #header-extra>
            {{ selectorResult.results.length + `个节点` }}
            <div p-l-8px></div>
            <NButton @click.stop="selectorResults.splice(index, 1)">
              删除
            </NButton>
          </template>
          <NSpace
            style="max-height: 400px; overflow-y: scroll; padding-bottom: 10px"
          >
            <NButton
              v-for="resultNode in selectorResult.results"
              :key="resultNode.key"
              @click="emit(`update:focusNode`, resultNode)"
              size="small"
            >
              {{ resultNode.label }}
            </NButton>
          </NSpace>
        </NCollapseItem>
      </NCollapse>
    </div>
  </DraggableCard>
</template>
