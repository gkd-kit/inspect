<script setup lang="ts">
import { findNodeByXy } from '@/utils/node';
import type { RawNode, Snapshot } from '@/utils/types';
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

const imgRef = shallowRef<HTMLImageElement>();

const clickEvRef = shallowRef<MouseEvent>();
watchEffect(() => {
  if (!props.rootNode) return;
  const ev = clickEvRef.value;
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
const imgHover = shallowRef(false);
const hoverPosition = shallowRef({ ox: 0, oy: 0 });
const imgMove = (ev: MouseEvent) => {
  const img = imgRef.value;
  if (!img) return;
  const imgRect = img.getBoundingClientRect();

  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  const offsetTop = (imgRect.height - innerHeight) / 2;

  const ox = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top - offsetTop) / innerHeight) * img.naturalHeight;
  hoverPosition.value = { ox, oy };
  hoverPositionStyle.value = {
    left: (-(ox - 0.1 * img.naturalWidth) / img.naturalWidth) * 1000 + 'px',
    top: (-(oy - 0.1 * img.naturalWidth) / img.naturalWidth) * 1000 + 'px',
  };
};
const hoverPositionStyle = shallowRef({ left: '0', top: '0' });
</script>

<template>
  <div flex flex-col relative h-full>
    <img
      ref="imgRef"
      :src="url"
      @click="clickEvRef = $event"
      cursor-crosshair
      h-full
      object-contain
      style="max-width: max(35vw, 400px)"
      @mouseover="imgHover = true"
      @mouseleave="imgHover = false"
      @mousemove="imgMove"
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

    <div
      v-show="imgHover"
      class="left-[calc(100%+4px)]"
      absolute
      top-0
      overflow-hidden
      z-1
      bg-white
      h-200px
      w-200px
      border-1px
      border-indigo-600
      border-dashed
    >
      <img
        :src="url"
        object-contain
        absolute
        left-0
        top-0
        :style="hoverPositionStyle"
        w-1000px
      />
      <div
        absolute
        left-0
        top-0
        class="leading-[1]"
        style="background-color: rgba(256, 256, 256, 0.7)"
      >
        {{ `${hoverPosition.ox.toFixed(0)},${hoverPosition.oy.toFixed(0)}` }}
      </div>
      <div
        class="top-[calc(50%-1px)]"
        absolute
        left-0
        right-0
        h-1px
        bg-repeat-x
        mix-blend-difference
        style="
          background: linear-gradient(
            to left,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );

          background-size: 10px 1px;
        "
      ></div>
      <div
        class="left-[calc(50%-1px)]"
        absolute
        top-0
        bottom-0
        w-1px
        bg-repeat-y
        mix-blend-difference
        style="
          background: linear-gradient(
            to top,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );
          background-size: 1px 10px;
        "
      ></div>
    </div>
  </div>
</template>
