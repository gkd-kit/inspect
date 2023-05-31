<script setup lang="ts">
import { getImageSize, traverseNode, xyInNode } from '@/utils';
import type { NaiveNode, SizeExt } from '@/utils/types';
import { computed, ref, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    url: string;
    node?: NaiveNode;
    focusNode?: NaiveNode;
    skipKeys?: number[];
  }>(),
  { skipKeys: () => [] },
);

const emit = defineEmits<{
  (e: 'update:focusNode', data: NaiveNode): void;
}>();

const sizeRef = ref<SizeExt>();
watchEffect(async () => {
  sizeRef.value = await getImageSize(props.url);
});

const evRef = ref<MouseEvent>();
watchEffect(() => {
  if (!props.node) return;
  const ev = evRef.value;
  const img = ev?.target;
  if (!ev || !img || !(img instanceof HTMLImageElement)) {
    return;
  }

  const imgRect = img.getBoundingClientRect();
  const ox = ((ev.clientX - imgRect.left) / img.offsetWidth) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top) / img.offsetHeight) * img.naturalHeight;
  for (const childNode of traverseNode(props.node, props.skipKeys)) {
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

const positionStyle = computed(() => {
  const size = sizeRef.value;
  if (!size || !props.focusNode) {
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
  <div flex flex-col relative>
    <img :src="url" @click="evRef = $event" class="h-100%" cursor-crosshair />
    <div
      :style="positionStyle"
      absolute
      pointer-events-none
      transition-all-300
      b-1px
      b-red
      b-solid
    ></div>
  </div>
</template>
