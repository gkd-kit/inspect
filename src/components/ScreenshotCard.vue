<script setup lang="ts">
import type { NodeX, SizeX } from '@/types';
import { getImageSize, traverseNode, xyInNode } from '@/utils';
import { computed, ref, watch, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    url: string;
    node: NodeX;
    focusNode: NodeX;
  }>(),
  {}
);

const emit = defineEmits<{
  (e: 'update:focusNode', data: NodeX): void;
}>();

const sizeRef = ref<SizeX>();
watchEffect(async () => {
  sizeRef.value = await getImageSize(props.url);
});

const evRef = ref<MouseEvent>();
watch(evRef, () => {
  const ev = evRef.value;
  const img = ev?.target;
  if (!ev || !img || !(img instanceof HTMLImageElement)) {
    return;
  }

  const imgRect = img.getBoundingClientRect();
  const ox = ((ev.clientX - imgRect.left) / img.offsetWidth) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top) / img.offsetHeight) * img.naturalHeight;
  for (const childNode of traverseNode(props.node)) {
    if (
      xyInNode(childNode, ox, oy) &&
      (childNode.children.length == 0 ||
        childNode.children.every((n) => !xyInNode(n, ox, oy)))
    ) {
      emit('update:focusNode', childNode);
      return;
    }
  }
});

const positionStyleRef = computed(() => {
  const size = sizeRef.value;
  if (!size) {
    return ``;
  }
  const attr = props.focusNode.value.attr;
  return {
    left: `calc(${(100 * attr.left) / size.width + '%'} - 1px)`,
    top: `calc(${(100 * attr.top) / size.height + '%'} - 1px)`,
    width: (100 * (attr.right - attr.left)) / size.width + '%',
    height: (100 * (attr.bottom - attr.top)) / size.height + '%',
  };
});
</script>

<template>
  <div class="ScreenshotCard">
    <img :src="url" @click="evRef = $event" />
    <div class="focus-box" :style="positionStyleRef"></div>
  </div>
</template>

<style scoped lang="scss">
.ScreenshotCard {
  display: flex;
  flex-direction: column;
  position: relative;
  // overflow: hidden;
  img {
    height: 100%;
    cursor: crosshair;
  }
  .focus-box {
    pointer-events: none;
    position: absolute;
    border-width: 1px;
    border-color: red;
    border-style: solid;
    transition: all 300ms;

    top: -1px;
    left: -1px;
    height: 100%;
    width: 100%;
  }
}
</style>
