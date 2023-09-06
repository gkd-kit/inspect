<script setup lang="ts">
import { findNodeByXy, getImageSize } from '@/utils/node';
import type { RawNode, SizeExt, Snapshot } from '@/utils/types';
import { computed, shallowRef, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    url: string;
    snapshot: Snapshot;
    rootNode?: RawNode;
    focusNode?: RawNode;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {
    onUpdateFocusNode: () => () => {},
  },
);

const sizeRef = shallowRef<SizeExt>();
watchEffect(async () => {
  sizeRef.value = await getImageSize(props.url);
});

const evRef = shallowRef<MouseEvent>();
watchEffect(() => {
  if (!props.rootNode) return;
  const ev = evRef.value;
  const img = ev?.target;
  if (!ev || !img || !(img instanceof HTMLImageElement)) {
    return;
  }

  const imgRect = img.getBoundingClientRect();
  const ox = ((ev.clientX - imgRect.left) / img.offsetWidth) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top) / img.offsetHeight) * img.naturalHeight;

  const childNode = findNodeByXy(props.snapshot.nodes, ox, oy);
  if (childNode) {
    props.onUpdateFocusNode(childNode);
  }
});

const positionStyle = computed(() => {
  const size = sizeRef.value;
  if (!size || !props.focusNode) {
    return ``;
  }
  const attr = props.focusNode.attr;
  return {
    left: `calc(${(100 * attr.left) / size.width + '%'} - 1px)`,
    top: `calc(${(100 * attr.top) / size.height + '%'} - 1px)`,
    width: (100 * (attr.right - attr.left)) / size.width + '%',
    height: (100 * (attr.bottom - attr.top)) / size.height + '%',
  };
});
</script>

<template>
  <div flex flex-col relative h-full>
    <img :src="url" @click="evRef = $event" h-full cursor-crosshair />
    <div
      :style="positionStyle"
      absolute
      pointer-events-none
      transition-all-300
      b-1px
      b-blue
      b-solid
    >
      <div
        absolute
        left--2px
        top--2px
        b-1px
        b-red
        b-solid
        style="height: calc(100% + 2px); width: calc(100% + 2px)"
      ></div>
    </div>
  </div>
</template>
