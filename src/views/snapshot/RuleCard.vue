<script setup lang="ts">
import DraggableCard from '@/components/DraggableCard.vue';
import { getNodeLabel } from '@/utils/node';
import { parseSelector, type GkdSelector } from '@/utils/selector';
import { gkdWidth, vw } from '@/utils/size';
import type { RawNode } from '@/utils/types';

const props = withDefaults(
  defineProps<{
    root: RawNode;
    focusNode?: RawNode;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {},
);

const tabShow = shallowRef(false);
const text = shallowRef('');
const lazyText = refDebounced(text, 500);

interface ResolvedData {
  matches: string[];
  anyMatches: string[];
  excludeMatches: string[];
}
const toArray = (v: any): string[] | undefined => {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v) && v.every((s) => typeof s === 'string')) return v;
};
const dataRef = computed<RawNode | string>(() => {
  if (!lazyText.value) return '';
  const obj = (() => {
    try {
      return JSON5.parse<ResolvedData>(lazyText.value);
    } catch (e) {
      return e as Error;
    }
  })();
  if (obj instanceof Error) {
    return `非法格式: ${obj.message}`;
  }
  if (typeof obj !== 'object' && obj !== null) {
    return '非法格式: 请使用对象格式';
  }
  const matches = toArray(obj.matches);
  if (!matches) {
    return '非法格式: matches';
  }
  const anyMatches = toArray(obj.anyMatches);
  if (!anyMatches) {
    return '非法格式: anyMatches';
  }
  const excludeMatches = toArray(obj.excludeMatches);
  if (!excludeMatches) {
    return '非法格式: excludeMatches';
  }

  const resolvedMatches: GkdSelector[] = [];
  for (let i = 0; i < matches.length; i++) {
    const v = matches[i];
    try {
      resolvedMatches.push(parseSelector(v));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return `非法选择器: matches[${i}]\n错误: ${message}`;
    }
  }
  const matchesResult = resolvedMatches.map((s) =>
    s.querySelectorAll(props.root),
  );
  if (resolvedMatches.length) {
    const notIndex = matchesResult.findIndex((s) => s.length === 0);
    if (notIndex >= 0) {
      return `无法匹配: matches[${notIndex}] 查找结果为空`;
    }
  }

  const resolvedAnyMatches: GkdSelector[] = [];
  for (let i = 0; i < anyMatches.length; i++) {
    const v = anyMatches[i];
    try {
      resolvedAnyMatches.push(parseSelector(v));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return `非法选择器: anyMatches[${i}]\n错误: ${message}`;
    }
  }
  const anyMatchesResult = resolvedAnyMatches.map((s) =>
    s.querySelectorAll(props.root),
  );
  if (resolvedAnyMatches.length) {
    if (anyMatchesResult.every((s) => s.length === 0)) {
      return `无法匹配: anyMatches 查找结果为空`;
    }
  }

  if (!matches.length && !anyMatches.length) {
    return '非法规则: matches 和 anyMatches 至少存在一个';
  }

  const resolvedExcludeMatches: GkdSelector[] = [];
  for (let i = 0; i < excludeMatches.length; i++) {
    const v = excludeMatches[i];
    try {
      resolvedExcludeMatches.push(parseSelector(v));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return `非法选择器: excludeMatches[${i}]\n错误: ${message}`;
    }
  }
  const excludeMatchesResult = resolvedExcludeMatches.map((s) =>
    s.querySelectorAll(props.root),
  );
  if (resolvedExcludeMatches.length) {
    const index = excludeMatchesResult.findIndex((s) => s.length !== 0);
    if (index >= 0) {
      return `无法匹配: excludeMatches[${index}] 查找结果不为空`;
    }
  }
  if (!matchesResult.length) {
    return anyMatchesResult[0][0];
  }
  return matchesResult.at(-1)![0];
});
const errorText = computed(() => {
  if (text.value && lazyText.value && typeof dataRef.value === 'string') {
    return dataRef.value;
  }
  return '';
});
const targetNode = computed(() => {
  if (typeof dataRef.value === 'string') return null;
  return dataRef.value;
});
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
    class="z-2 box-shadow-dim"
    :show="tabShow"
  >
    <div bg-white b-1px b-solid b-gray-200 rounded-4px p-8px>
      <div flex m-b-4px pr-4px>
        <div>测试规则</div>
        <div flex-1 cursor-move :ref="onRef"></div>
        <NButton @click="tabShow = !tabShow" text title="最小化">
          <template #icon>
            <NIcon>
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 13v-2h12v2z" />
              </svg>
            </NIcon>
          </template>
        </NButton>
      </div>
      <NInput
        v-model:value="text"
        type="textarea"
        placeholder="请输入单个规则测试"
        size="small"
        class="gkd_code m-b-4px"
        :autosize="{
          minRows: 10,
          maxRows: 20,
        }"
      />
      <div min-h-24px>
        <div color-red whitespace-pre v-if="errorText">{{ errorText }}</div>

        <NButton
          v-else-if="targetNode"
          @click="onUpdateFocusNode?.(targetNode)"
          size="small"
          :class="{
            'color-[#00F]': targetNode === focusNode,
          }"
        >
          {{ getNodeLabel(targetNode) }}
        </NButton>
      </div>
    </div>
  </DraggableCard>
  <DraggableCard
    :initialValue="{
      bottom: 56,
      right: 16,
    }"
    :minWidth="300"
    v-slot="{ onRef, moved }"
    class="z-1 box-shadow-dim rounded-1/2 bg-white"
    :show="!tabShow"
  >
    <div :ref="onRef">
      <NButton
        @click="
          if (!moved) {
            tabShow = !tabShow;
          }
        "
        circle
        size="large"
        title="测试规则"
      >
        <template #icon>
          <NIcon>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M14.4 20L13 18.6l2.6-2.6l-2.6-2.6l1.4-1.4l2.6 2.6l2.6-2.6l1.4 1.4l-2.6 2.6l2.6 2.6l-1.4 1.4l-2.6-2.6zm1.975-9l-3.55-3.55l1.4-1.4l2.125 2.125l4.25-4.25L22 5.35zM2 17v-2h9v2zm0-8V7h9v2z"
              />
            </svg>
          </NIcon>
        </template>
      </NButton>
    </div>
  </DraggableCard>
</template>
