<script setup lang="ts">
import TextLine from './TextLine.vue';
import { useTextViewerState } from './context';

const {
  wrap,
  virtualList,
  scrollContainer,
  lineHeight,
  lines,
  visibleStart,
  visibleLines,
  virtualHeight,
  handleScroll,
} = useTextViewerState();
</script>

<template>
  <div name="text-viewer-viewport" class="h-full min-h-0 min-w-0">
    <NVirtualList
      v-if="wrap"
      ref="virtualList"
      :items="lines"
      :item-size="lineHeight"
      item-resizable
      keyField="key"
      class="h-full min-h-0 min-w-0 rounded-4px border border-[#e5e7eb] bg-white font-mono text-13px leading-20px"
    >
      <template #default="{ item }">
        <TextLine :line="item" />
      </template>
    </NVirtualList>
    <div
      v-else
      ref="scrollContainer"
      class="h-full min-h-0 min-w-0 overflow-auto rounded-4px border border-[#e5e7eb] bg-white font-mono text-13px leading-20px"
      @scroll="handleScroll"
    >
      <div
        name="text-viewer-spacer"
        class="relative min-w-full"
        :style="{ height: `${virtualHeight}px` }"
      >
        <div
          name="text-viewer-visible"
          class="absolute left-0 top-0 min-w-full w-max"
          :style="{ transform: `translateY(${visibleStart * lineHeight}px)` }"
        >
          <TextLine v-for="line in visibleLines" :key="line.key" :line="line" />
        </div>
      </div>
    </div>
  </div>
</template>
