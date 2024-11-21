<script setup lang="ts">
import DraggableCard from '@/components/DraggableCard.vue';
import { getNodeLabel, getNodeStyle } from '@/utils/node';

const snapshotStore = useSnapshotStore();
const { focusNode, overlapNodes, focusPosition } = storeToRefs(snapshotStore);
const _1vw = document.documentElement.scrollWidth / 100;
const left = _1vw * 25.5;
</script>
<template>
  <DraggableCard
    :initialValue="{ top: 215, left }"
    v-slot="{ onRef }"
    class="box-shadow-dim w-420px"
    :show="Boolean(overlapNodes && focusPosition)"
  >
    <NCard
      v-if="overlapNodes && focusPosition"
      size="small"
      closable
      @close="overlapNodes = undefined"
    >
      <template #header>
        <div :ref="onRef" cursor-move>
          位置
          <span bg="#eee" px-2px>{{
            `${focusPosition.x.toFixed(0)},${focusPosition.y.toFixed()}`
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
          @click="snapshotStore.updateFocusNode(resultNode)"
          size="small"
          :style="getNodeStyle(resultNode, focusNode)"
        >
          {{ getNodeLabel(resultNode) }}
        </NButton>
      </NSpace>
    </NCard>
  </DraggableCard>
</template>
