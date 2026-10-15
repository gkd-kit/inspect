<script lang="ts">
import { NButton, NScrollbar } from 'naive-ui';
import { defineAsyncComponent } from 'vue';

import GkSvg from '@/shared/ui/GkSvg.vue';
const SelectorTrackGraphLoader = () => import('./SelectorTrackGraph.vue');
const SelectorTrackGraph = defineAsyncComponent({
  loader: SelectorTrackGraphLoader,
  delay: 0,
});
setTimeout(SelectorTrackGraphLoader, 3000);
</script>
<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { RawNode } from '@/entities/snapshot/types';

import SelectorText from './SelectorText.vue';
import { buildEmptyFn } from '@/shared/lib/function';
import { colorList } from '@/shared/ui/colors';
import { type ResolvedSelector } from '@/entities/selector/parser';
import type { SelectorMatch, SelectorMatchUnit } from '@gkd-kit/selector';

const props = withDefaults(
  defineProps<{
    nodes: RawNode[];
    queryResult: SelectorMatch<RawNode>;
    selector: ResolvedSelector;
    onClose?: () => void;
  }>(),
  {
    onClose: buildEmptyFn,
  },
);

const allUnitResults = computed(() => {
  if (!props.queryResult) return [];
  return props.queryResult.units;
});

const singleUnitResults = computed(() => {
  return allUnitResults.value.filter((v) => v.steps.length === 0);
});

const showUnitResults = computed(() => {
  return allUnitResults.value.filter((v) => v.steps.length > 0);
});

const filterUnitResults = shallowRef<SelectorMatchUnit<RawNode>[]>([
  ...showUnitResults.value,
]);
const switchUnitResult = (unitResult: SelectorMatchUnit<RawNode>) => {
  if (filterUnitResults.value.includes(unitResult)) {
    filterUnitResults.value = filterUnitResults.value.filter(
      (v) => v !== unitResult,
    );
  } else {
    filterUnitResults.value = filterUnitResults.value.concat(unitResult);
  }
};

const highlightedRanges = computed(() =>
  allUnitResults.value
    .map((unit) => unit.range)
    .filter((range) => range != null),
);
</script>
<template>
  <div
    class="SelectorTrackCard flex flex-col h-full p-[12px] box-border gap-[8px] overflow-hidden"
  >
    <div class="[--svg-h:24px] flex justify-between items-center">
      <div class="flex items-center gap-[4px]">
        <GkSvg name="path" />
        <div class="text-[20px]/[28px] font-bold">选择器路径视图</div>
      </div>
      <NButton text @click="onClose">
        <GkSvg name="close" />
      </NButton>
    </div>
    <div class="flex-1 flex gap-[12px] overflow-hidden">
      <div class="self-stretch flex-[2]">
        <SelectorTrackGraph
          v-if="nodes.length && queryResult"
          :nodes="nodes"
          :queryResult="queryResult"
          :showUnitResults="showUnitResults"
          :filterUnitResults="filterUnitResults"
          class="h-[calc(100%-2px)] border-[1px] border-solid"
        />
        <div class="relative pointer-events-none z-1">
          <div
            class="absolute left-[8px] bottom-[8px] text-[14px]/[14px] text-[#6C6E71]"
          >
            *为简化视图已隐藏无关节点
          </div>
        </div>
      </div>
      <NScrollbar
        class="self-stretch flex-1 text-[20px] leading-[28px] gkd_code"
      >
        <div class="app-subtle mb-[24px] break-all px-[4px] py-[2px]">
          <SelectorText
            :source="selector.source"
            :tokens="selector.tokens"
            :positions="selector.positions"
            :highlightedRanges="highlightedRanges"
          />
        </div>
        <div class="flex flex-col gap-[12px]">
          <div v-if="singleUnitResults.length" class="flex gap-[8px]">
            <div
              v-for="(unitResult, i) in singleUnitResults"
              :key="i"
              class="break-all px-[4px] py-[2px] border-[1px] border-solid border-[#ccc]"
            >
              <SelectorText
                :source="selector.source"
                :tokens="selector.tokens"
                :positions="selector.positions"
                :range="unitResult.range"
              />
            </div>
          </div>
          <div
            v-for="(unitResult, i) in showUnitResults"
            :key="i"
            class="cursor-pointer break-all px-[4px] py-[2px] border-[1px] border-solid transition-colors"
            :style="{
              borderColor: colorList[i % colorList.length],
              backgroundColor: filterUnitResults.includes(unitResult)
                ? 'var(--app-subtle)'
                : undefined,
            }"
            @click="switchUnitResult(unitResult)"
          >
            <div
              class="inline-block align-middle size-[20px]"
              :style="{
                backgroundColor: colorList[i % colorList.length],
              }"
            />
            <span class="pl-[4px]" />
            <SelectorText
              :source="selector.source"
              :tokens="selector.tokens"
              :positions="selector.positions"
              :range="unitResult.range"
            />
          </div>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>
