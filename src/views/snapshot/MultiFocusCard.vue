<script setup lang="ts">
import { getNodeLabel } from '@/utils/node';
import { buildEmptyFn } from '@/utils/others';
import type { RawNode } from '@/utils/types';
import DraggableCard from '@/components/DraggableCard.vue';

const props = withDefaults(
  defineProps<{
    focusNode?: RawNode;
    focusNodes?: {
      nodes: RawNode[];
      position: { x: number; y: number };
    };
    onUpdateFocusNode?: (data: RawNode) => void;
    onClose?: () => void;
  }>(),
  {
    onUpdateFocusNode: buildEmptyFn,
    onUpdateTrack: buildEmptyFn,
    onClose: buildEmptyFn,
  },
);
const _1vw = document.documentElement.scrollWidth / 100;
const left = _1vw * 25.5;
const show = computed(() => {
  return (props.focusNodes?.nodes?.length || 0) > 1;
});
</script>
<template>
  <DraggableCard
    :initialValue="{ top: 215, left }"
    v-slot="{ onRef }"
    class="z-2 box-shadow-dim w-420px"
    :show="show"
  >
    <NCard v-if="show && focusNodes" size="small" closable @close="onClose">
      <template #header>
        <div :ref="onRef" cursor-move>
          位置
          <span bg="#eee" px-2px>{{
            `${focusNodes.position.x.toFixed(0)},${focusNodes.position.y.toFixed()}`
          }}</span>
          存在 {{ focusNodes.nodes.length }} 个层叠节点
        </div>
      </template>
      <NSpace
        style="max-height: 400px; overflow-y: scroll; padding-bottom: 10px"
      >
        <NButton
          v-for="resultNode in focusNodes.nodes"
          :key="resultNode.id"
          @click="onUpdateFocusNode(resultNode)"
          size="small"
          :class="{ 'color-[#00F]': resultNode === focusNode }"
        >
          {{ getNodeLabel(resultNode) }}
        </NButton>
      </NSpace>
    </NCard>
  </DraggableCard>
</template>
