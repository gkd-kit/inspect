<script setup lang="ts">
import { findNodesByXy } from '@/utils/node';
import { buildEmptyFn } from '@/utils/others';
import type { RawNode, Snapshot } from '@/utils/types';
import { refDebounced, useWindowSize } from '@vueuse/core';
import { computed, shallowRef } from 'vue';

const props = withDefaults(
  defineProps<{
    url: string;
    snapshot: Snapshot;
    rootNode?: RawNode;
    focusNode?: RawNode;
    onUpdateFocusNode?: (data: RawNode) => void;
    onUpdateFocusNodes?: (data: {
      nodes: RawNode[];
      position: { x: number; y: number };
    }) => void;
  }>(),
  {
    onUpdateFocusNode: buildEmptyFn,
    onUpdateFocusNodes: buildEmptyFn,
  },
);
const windowSize = useWindowSize();
const debouncedSize = refDebounced(
  computed(() => {
    windowSize.width.value;
    windowSize.height.value;
    return Math.random();
  }),
  300,
);

const imgRef = shallowRef<HTMLImageElement>();

const clickImg = (ev: MouseEvent) => {
  if (!props.rootNode) return;
  const img = imgRef.value;
  if (!img) {
    return;
  }

  const imgRect = img.getBoundingClientRect();

  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  const offsetTop = (imgRect.height - innerHeight) / 2;

  const ox = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top - offsetTop) / innerHeight) * img.naturalHeight;

  const results = findNodesByXy(props.snapshot.nodes, ox, oy);
  if (results.length === 0) return;
  if (results.length === 1) {
    props.onUpdateFocusNode(results[0]);
  } else {
    props.onUpdateFocusNode(results[0]);
    props.onUpdateFocusNodes({ nodes: results, position: { x: ox, y: oy } });
  }
};

const percent = (n: number) => {
  return `${n * 100}%`;
};
const positionStyle = computed(() => {
  debouncedSize.value;
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
const boxHoverPosition = computed(() => {
  const attr = props.focusNode?.attr;
  if (!attr) {
    return;
  }
  const { ox, oy } = hoverPosition.value;
  return {
    left: ox - attr.left,
    right: attr.right - ox,
    top: oy - attr.top,
    bottom: attr.bottom - oy,
  };
});
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
      @click="clickImg"
      cursor-crosshair
      h-full
      object-contain
      class="max-w-[calc(var(--gkd-width)*0.35)]"
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
        left-2px
        top-2px
        p-1px
        z-1
        text-13px
        class="leading-[1] bg-[rgba(256,256,256,0.7)]"
      >
        {{ `${hoverPosition.ox.toFixed(0)},${hoverPosition.oy.toFixed(0)}` }}
      </div>
      <div
        v-if="boxHoverPosition"
        absolute
        left-2px
        bottom-2px
        p-1px
        z-1
        text-12px
        class="leading-[1] bg-[rgba(256,256,256,0.7)]"
        flex
        flex-col
        flex-items-center
      >
        <div>{{ boxHoverPosition.top.toFixed(0) }}</div>
        <div>
          {{
            boxHoverPosition.left.toFixed(0) +
            ',' +
            boxHoverPosition.right.toFixed(0)
          }}
        </div>
        <div>{{ boxHoverPosition.bottom.toFixed(0) }}</div>
      </div>
      <div
        class="top-[calc(50%-1px)] bg-[length:10px_1px]"
        absolute
        left-0
        right-0
        h-1px
        bg-repeat-x
        mix-blend-difference
        style="
          background-image: linear-gradient(
            to left,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );
          background-position-x: 1.5px;
        "
      ></div>
      <div
        class="left-[calc(50%-1px)] bg-[length:1px_10px]"
        absolute
        top-0
        bottom-0
        w-1px
        bg-repeat-y
        mix-blend-difference
        style="
          background-image: linear-gradient(
            to top,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );
          background-position-y: 1.5px;
        "
      ></div>
    </div>
  </div>
</template>
