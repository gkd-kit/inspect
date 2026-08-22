<script setup lang="ts">
import type { SourceLinkContext } from '../source_links';
import CopyButton from './CopyButton.vue';
import SearchBar from './SearchBar.vue';
import Viewport from './Viewport.vue';
import { useProvideTextViewerState } from './context';

const props = withDefaults(
  defineProps<{
    value: string;
    documentKey?: string;
    searchPlaceholder?: string;
    allowWrap?: boolean;
    copyable?: boolean;
    sourceLinkContext?: SourceLinkContext;
  }>(),
  {
    searchPlaceholder: `搜索`,
    allowWrap: false,
    copyable: false,
  },
);

const state = useProvideTextViewerState({
  value: toRef(props, `value`),
  documentKey: toRef(props, `documentKey`),
  searchPlaceholder: toRef(props, `searchPlaceholder`),
  allowWrap: toRef(props, `allowWrap`),
  copyable: toRef(props, `copyable`),
  sourceLinkContext: toRef(props, `sourceLinkContext`),
});

const { allowWrap: allowWrapRef, wrap } = state;
</script>

<template>
  <div name="text-viewer" class="min-h-0 min-w-0 flex flex-1 flex-col gap-8px">
    <div
      name="text-viewer-toolbar"
      class="min-h-28px min-w-0 flex items-center gap-10px"
    >
      <slot name="toolbar-start" />
      <div name="text-viewer-toolbar-spacer" class="min-w-0 flex-1" />
      <SearchBar />
      <NCheckbox v-if="allowWrapRef" v-model:checked="wrap">
        自动换行
      </NCheckbox>
    </div>
    <div name="text-viewer-content" class="relative min-h-0 min-w-0 flex-1">
      <Viewport />
      <CopyButton />
    </div>
  </div>
</template>
