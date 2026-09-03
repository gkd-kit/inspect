<script setup lang="ts">
import DraggableCard from '@/components/base/DraggableCard.vue';
import type { DraggableCardValue } from '@/components/base/draggable';
import { getNodeLabel, getNodeStyle } from '@/domain/snapshot/node';
import { useSnapshotStore } from './snapshot';

const {
  focusNode,
  overlapNodes,
  focusPosition,
  updateFocusNode,
  closeOverlap,
} = useSnapshotStore();
const props = defineProps<{
  layout?: DraggableCardValue;
}>();
const emit = defineEmits<{
  updateLayout: [value: DraggableCardValue];
}>();
const _1vw = document.documentElement.scrollWidth / 100;
const left = _1vw * 25.5;
const draggableInitialValue = computed(() => ({
  top: 215,
  left,
  ...props.layout,
}));
const updateLayout = (value: DraggableCardValue) => {
  emit('updateLayout', value);
};
</script>
<template>
  <DraggableCard
    v-slot="{ onRef }"
    :initialValue="draggableInitialValue"
    class="box-shadow-dim w-420px"
    :show="Boolean(overlapNodes && focusPosition)"
    @update:value="updateLayout"
  >
    <NCard
      v-if="overlapNodes && focusPosition"
      size="small"
      closable
      @close="closeOverlap"
    >
      <template #header>
        <div :ref="onRef" cursor-move>
          位置
          <span class="app-subtle" px-2px>{{
            `${focusPosition.x.toFixed(0)},${focusPosition.y.toFixed(0)}`
          }}</span>
          存在 {{ overlapNodes.length }} 个层叠节点
        </div>
      </template>
      <NSpace
        style="max-height: 400px; overflow-y: scroll; padding-bottom: 10px"
        class="scrollbar-hidden"
      >
        <NButton
          v-for="resultNode in overlapNodes"
          :key="resultNode.id"
          size="small"
          :style="getNodeStyle(resultNode, focusNode)"
          @click="updateFocusNode(resultNode)"
        >
          {{ getNodeLabel(resultNode) }}
        </NButton>
      </NSpace>
    </NCard>
  </DraggableCard>
</template>
