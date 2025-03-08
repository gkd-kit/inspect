<script lang="ts">
const TrackGraphLoader = () => import('@/components/TrackGraph.vue');
const TrackGraph = defineAsyncComponent({
  loader: TrackGraphLoader,
  delay: 0,
});
setTimeout(TrackGraphLoader, 3000);
</script>
<script setup lang="ts">
import SelectorText from '@/components/SelectorText.vue';
import { buildEmptyFn, colorList } from '@/utils/others';
import { type ResolvedSelector } from '@/utils/selector';
import type { RawNode } from '@/utils/types';
import type { AstNode, QueryResult } from '@gkd-kit/selector';
import { UnitSelectorExpression } from '@gkd-kit/selector';
import type { StyleValue } from 'vue';

const props = withDefaults(
  defineProps<{
    nodes: RawNode[];
    queryResult: QueryResult<RawNode>;
    selector: ResolvedSelector;
    onClose?: () => void;
  }>(),
  {
    onClose: buildEmptyFn,
  },
);

const allUnitResults = computed(() => {
  if (!props.queryResult) return [];
  return props.queryResult.unitResults.asJsReadonlyArrayView().concat();
});

const singleUnitResults = computed(() => {
  return allUnitResults.value.filter((v) => !v.context.prev);
});

const showUnitResults = computed(() => {
  return allUnitResults.value.filter((v) => v.context.prev);
});

const filterUnitResults = shallowRef<QueryResult.UnitResult<RawNode>[]>([]);
watchEffect(() => {
  filterUnitResults.value = showUnitResults.value;
});
const switchUnitResult = (unitResult: QueryResult.UnitResult<RawNode>) => {
  if (filterUnitResults.value.includes(unitResult)) {
    filterUnitResults.value = filterUnitResults.value.filter(
      (v) => v !== unitResult,
    );
  } else {
    filterUnitResults.value = filterUnitResults.value.concat(unitResult);
  }
};

const getNodeStyle = (node: AstNode<any>): StyleValue => {
  const value = node.value;
  if (
    value instanceof UnitSelectorExpression &&
    allUnitResults.value.some((u) => u.expression === value) &&
    !node.outChildren.some((v) => v.value instanceof UnitSelectorExpression)
  ) {
    return {
      outline: '1px solid #00F',
    };
  }
  return '';
};
</script>
<template>
  <div
    class="TrackCard"
    flex
    flex-col
    h-full
    p-12px
    box-border
    gap-8px
    overflow-hidden
  >
    <div flex justify-between items-center>
      <div flex items-center gap-4px>
        <SvgIcon name="path" h="24px" />
        <div text="20px/28px" font-bold>选择器路径视图</div>
      </div>
      <NButton text @click="onClose">
        <SvgIcon name="close" h="20px" />
      </NButton>
    </div>
    <div flex-1 flex gap-12px overflow-hidden>
      <div self-stretch flex="[2]">
        <TrackGraph
          v-if="nodes.length && queryResult"
          :nodes="nodes"
          :queryResult="queryResult"
          :showUnitResults="showUnitResults"
          :filterUnitResults="filterUnitResults"
          class="h-[calc(100%-2px)] b-1px b-solid"
        />
        <div relative pointer-events-none z-1>
          <div absolute left-8px bottom-8px text="12px/14px #6C6E71">
            *为简化视图已隐藏无关节点
          </div>
        </div>
      </div>
      <NScrollbar class="self-stretch flex-1">
        <div mb-24px break-all px-4px py-2px leading-20px bg="#eee" gkd_code>
          <SelectorText
            class="gkd_code"
            :source="selector.source"
            :node="selector.ast"
            :getNodeStyle="getNodeStyle"
          />
        </div>
        <div flex flex-col gap-12px>
          <div v-if="singleUnitResults.length" flex gap-8px>
            <div
              v-for="(unitResult, i) in singleUnitResults"
              :key="i"
              break-all
              px-4px
              py-2px
              gkd_code
              b-1px
              b-solid
              b="#ccc"
            >
              <SelectorText
                class="gkd_code"
                :source="selector.source"
                :node="selector.findAst(unitResult.expression)"
              />
            </div>
          </div>
          <div
            v-for="(unitResult, i) in showUnitResults"
            :key="i"
            cursor-pointer
            break-all
            px-4px
            py-2px
            gkd_code
            b-1px
            b-solid
            transition-colors
            @click="switchUnitResult(unitResult)"
            :style="{
              borderColor: colorList[i % colorList.length],
              backgroundColor: filterUnitResults.includes(unitResult)
                ? '#eee'
                : undefined,
            }"
          >
            <div
              inline-block
              align-middle
              size-16px
              :style="{
                backgroundColor: colorList[i % colorList.length],
              }"
            ></div>
            <span pl-4px></span>
            <SelectorText
              class="gkd_code"
              :source="selector.source"
              :node="selector.findAst(unitResult.expression)"
            />
          </div>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>
