<script setup lang="ts">
import type { VirtualTextLine } from '../virtual_text';
import { useTextViewerState } from './context';

const props = defineProps<{
  line: VirtualTextLine;
}>();

const { wrap, getLineSegments, setActiveMatchElement } = useTextViewerState();
const segments = computed(() => getLineSegments(props.line));
</script>

<template>
  <div
    name="text-viewer-line"
    class="grid min-h-20px min-w-full leading-20px"
    :class="
      wrap
        ? 'w-full grid-cols-[64px_minmax(0,1fr)]'
        : 'w-max grid-cols-[64px_max-content]'
    "
  >
    <span
      class="sticky left-0 z-1 box-border select-none border-r border-[#e5e7eb] bg-[#f8fafc] px-10px text-right text-[#94a3b8]"
    >
      {{ line.number }}
    </span>
    <span
      class="box-border min-w-0 px-10px [font:inherit] [tab-size:2]"
      :class="
        wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre'
      "
    >
      <template v-for="(segment, index) in segments" :key="index">
        <span
          v-if="segment.match"
          :ref="segment.active ? setActiveMatchElement : undefined"
          name="text-viewer-match"
          :data-active="segment.active ? '' : undefined"
          class="rounded-2px text-inherit"
          :class="
            segment.active ? 'bg-[#fb923c] text-[#7c2d12]' : 'bg-[#fde68a]'
          "
        >
          {{ segment.text }}
        </span>
        <template v-else>{{ segment.text }}</template>
      </template>
    </span>
  </div>
</template>
