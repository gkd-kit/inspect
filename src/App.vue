<script setup lang="ts">
import testWindow from '@/assets/screenshot.json';
import testUrl from '@/assets/screenshot.png';
import AttrCard from '@/components/AttrCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import type { NodeX, WindowX } from '@/types';
import { toNodeTree } from '@/utils';
import { ref, type Ref } from 'vue';
import WindowCard from './components/WindowCard.vue';

const rootNode = toNodeTree(
  testWindow.nodes.map((n) => ({
    ...n,
    attr: {
      ...n.attr,
      index: 0,
      depth: 0,
    },
  }))
);

const windowX: WindowX = {
  ...testWindow,
  node: rootNode,
};

const focusNode: Ref<NodeX> = ref(rootNode);
</script>

<template>
  <ScreenshotCard
    :url="testUrl"
    :node="rootNode"
    :focus-node="focusNode"
    @update:focus-node="focusNode = $event"
  />
  <WindowCard
    :window-x="windowX"
    :focus-node="focusNode"
    @update:focus-node="focusNode = $event"
  />
  <AttrCard :attr="focusNode.value.attr" />
</template>

<style scoped lang="scss">
.WindowCard {
  flex: 1;
}
.AttrCard {
  position: fixed;
  top: 90px;
  right: 30px;
}
</style>
<style>
#app {
  min-width: 1200px;
  min-height: 700px;
  display: flex;
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 10px;
  gap: 10px;
}
</style>
