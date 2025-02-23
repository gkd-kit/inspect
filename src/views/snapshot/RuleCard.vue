<script setup lang="ts">
import DraggableCard from '@/components/DraggableCard.vue';
import { getNodeLabel, getNodeStyle } from '@/utils/node';
import { buildEmptyFn } from '@/utils/others';
import { parseSelector, type ResolvedSelector } from '@/utils/selector';
import { gkdWidth, vw } from '@/utils/size';
import type { RawNode, Snapshot } from '@/utils/types';
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

const snapshotStore = useSnapshotStore();
const snapshotRefs = storeToRefs(snapshotStore);
const { rootNode, focusNode } = snapshotRefs;
const snapshot = snapshotRefs.snapshot as ShallowRef<Snapshot>;

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
const checkRule = (obj: ResolvedData): string | RawNode => {
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

  const resolvedMatches: ResolvedSelector[] = [];
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
    s.querySelectorAll(rootNode.value),
  );
  if (resolvedMatches.length) {
    const notIndex = matchesResult.findIndex((s) => s.length === 0);
    if (notIndex >= 0) {
      return `无法匹配: matches[${notIndex}] 查找结果为空`;
    }
  }

  const resolvedAnyMatches: ResolvedSelector[] = [];
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
    s.querySelectorAll(rootNode.value),
  );
  if (resolvedAnyMatches.length) {
    if (anyMatchesResult.every((s) => s.length === 0)) {
      return `无法匹配: anyMatches 查找结果为空`;
    }
  }

  if (!matches.length && !anyMatches.length) {
    return '非法规则: matches 和 anyMatches 至少存在一个';
  }

  const resolvedExcludeMatches: ResolvedSelector[] = [];
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
    s.querySelectorAll(rootNode.value),
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
};

const isObj = (v: any): v is Record<string, any> => {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
};

const dataRef = computed<RawNode | string>(() => {
  if (!lazyText.value) return '';
  const obj = (() => {
    try {
      return JSON5.parse(lazyText.value);
    } catch (e) {
      return e as Error;
    }
  })();
  if (obj instanceof Error) {
    return `非法格式: ${obj.message}`;
  }
  if (!isObj(obj)) {
    return '非法格式: 请使用对象格式';
  }
  if (typeof obj.id === 'string') {
    if (obj.id !== snapshot.value.appId) {
      return '非法格式: id 不匹配 appId';
    }
    if (!Array.isArray(obj.groups)) {
      return '非法格式: groups 不是数组';
    }
    if (obj.groups.length !== 1) {
      return '非法格式: groups 长度不为 1';
    }
    const group = obj.groups[0];
    if (!group?.rules) {
      return '非法格式: groups[0].rules 非法';
    }
    const rules = Array.isArray(group.rules) ? group.rules : [group.rules];
    if (rules.length !== 1) {
      return '非法格式: groups[0].rules 长度不为 1';
    }
    const rule =
      typeof rules[0] === 'string' ? { matches: rules[0] } : rules[0];
    if (!isObj(rule)) {
      return '非法格式: rules[0] 非法';
    }
    return checkRule(rule as ResolvedData);
  }
  if (obj.rules) {
    const rules = Array.isArray(obj.rules) ? obj.rules : [obj.rules];
    if (rules.length !== 1) {
      return '非法格式: rules 长度不为 1';
    }
    const rule =
      typeof rules[0] === 'string' ? { matches: rules[0] } : rules[0];
    if (!isObj(rule)) {
      return '非法格式: rules[0] 非法';
    }
    return checkRule(rule as ResolvedData);
  }
  return checkRule(obj as ResolvedData);
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
    class="box-shadow-dim"
    :show="show"
  >
    <div bg-white b-1px b-solid b-gray-200 rounded-4px p-8px>
      <div flex m-b-4px pr-4px>
        <div>测试规则</div>
        <div flex-1 cursor-move :ref="onRef"></div>
        <NButton @click="onUpdateShow(!show)" text title="最小化">
          <template #icon>
            <SvgIcon name="minus" />
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
          @click="snapshotStore.updateFocusNode(targetNode)"
          size="small"
          :style="getNodeStyle(targetNode, focusNode)"
        >
          {{ getNodeLabel(targetNode) }}
        </NButton>
      </div>
    </div>
  </DraggableCard>
</template>
