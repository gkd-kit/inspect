<script setup lang="ts">
import { findNodeByXy, getImageSize } from '@/utils/node';
import type { RawNode, SizeExt, Snapshot } from '@/utils/types';
import { computed, shallowRef, watchEffect, defineComponent } from 'vue';

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

// const sizeRef = shallowRef<SizeExt>();
// watchEffect(async () => {
//   sizeRef.value = await getImageSize(props.url);
// });
const imgRef = shallowRef<HTMLImageElement>();

const evRef = shallowRef<MouseEvent>();
watchEffect(() => {
  if (!props.rootNode) return;
  const ev = evRef.value;
  const img = imgRef.value;
  if (!ev || !img) {
    return;
  }

  const imgRect = img.getBoundingClientRect();

  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  const offsetTop = (imgRect.height - innerHeight) / 2;

  const ox = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top - offsetTop) / innerHeight) * img.naturalHeight;

  const childNode = findNodeByXy(props.snapshot.nodes, ox, oy);
  if (childNode) {
    props.onUpdateFocusNode(childNode);
  }
});
const percent = (n: number) => {
  return `${n * 100}%`;
};
const positionStyle = computed(() => {
  const img = imgRef.value;
  const attr = props.focusNode?.attr;
  if (!props.focusNode || !img || !attr) {
    return ``;
  }
  const imgRect = img.getBoundingClientRect();
  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  return {
    left: `calc(${percent(attr.left / img.naturalWidth)} - 2px)`,
    width: `calc(${percent(
      (attr.right - attr.left) / img.naturalWidth,
    )} + 2px)`,

    top: `calc(${percent(
      ((attr.top / img.naturalHeight) * innerHeight +
        (imgRect.height - innerHeight) / 2) /
        imgRect.height,
    )} - 2px)`,
    height: `calc(${percent(
      (((attr.bottom - attr.top) / img.naturalHeight) * innerHeight) /
        imgRect.height,
    )} + 2px)`,
  };
});
</script>

<template>
  <div flex flex-col relative h-full>
    <img
      ref="imgRef"
      :src="url"
      @click="evRef = $event"
      cursor-crosshair
      h-full
      object-contain
      style="max-width: max(35vw, 400px);"
    />
    <div
      :style="positionStyle"
      absolute
      pointer-events-none
      transition-all-300
      b-1px
      b-blue
      b-solid
    >
      <div absolute left-0 top-0 bottom-0 right-0 b-solid b-1px b-red></div>
    </div>
  </div>
</template>
