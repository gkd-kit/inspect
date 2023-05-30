<script setup lang="ts">
import { toSelectorLiteral } from '@/utils';
import type { RawAttr } from '@/utils/types';
import { NTable, NTbody, NTd, NTh, NTr } from 'naive-ui';
import { computed, reactive, ref } from 'vue';

const props = withDefaults(defineProps<{ attr: RawAttr }>(), {});

const attrs = computed(() => {
  return Object.entries(props.attr).map(([name, value]) => {
    return {
      name,
      value,
    };
  });
});

const offset = reactive({ x: 0, y: 0 });
const movingRef = ref(false);
let lastEv: MouseEvent | undefined = undefined;
const mousemoveRef = async (ev: MouseEvent) => {
  if (!movingRef.value) {
    lastEv = undefined;
    return;
  }
  lastEv ??= ev;
  const dx = ev.pageX - lastEv.pageX;
  const dy = ev.pageY - lastEv.pageY;
  lastEv = ev;
  offset.x += dx;
  offset.y += dy;
};
</script>

<template>
  <div
    class="AttrCard"
    :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }"
    flex
    flex-col
  >
    <NTable size="small" striped :single-line="false">
      <thead
        @mousedown="movingRef = true"
        @mousemove="mousemoveRef"
        @mouseup="movingRef = false"
        cursor-all-scroll
      >
        <NTr>
          <NTh> Name </NTh>
          <NTh> Value </NTh>
        </NTr>
      </thead>
      <NTbody>
        <NTr v-for="(attrx, index) in attrs" :key="index" class="code-text">
          <NTd>{{ attrx.name }}</NTd>
          <NTd>
            {{ toSelectorLiteral(attrx.value) }}
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </div>
</template>
