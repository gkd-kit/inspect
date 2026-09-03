<script setup lang="ts">
import type { CSSProperties } from 'vue';

const { y, x } = useWindowScroll();
const { height: winH, width: winW } = useWindowSize();
const [bodyH, bodyW] = (() => {
  const body = useElementSize(document.body);
  // 不知道为什么得到的 w/h 比实际 clientHeight/clientWidth 多出 0.2 或 0.4, 使用 Math.floor 去除
  return [
    computed(() => Math.floor(body.height.value)),
    computed(() => Math.floor(body.width.value)),
  ];
})();

const yShow = computed(() => bodyH.value > winH.value);
const yHeight = computed(() => {
  return (winH.value / bodyH.value) * winH.value;
});
const translateY = computed(() => {
  const height = yHeight.value;
  return (y.value / (bodyH.value - winH.value)) * (winH.value - height);
});
const yStyle = computed<CSSProperties>(() => {
  if (!yShow.value) return {};
  return {
    transform: `translateY(${translateY.value}px)`,
    height: `${yHeight.value}px`,
  };
});
const clickBoxY = async (e: MouseEvent) => {
  const deltaY =
    yHeight.value *
    0.9 *
    (e.clientY < yHeight.value + translateY.value ? -1 : 1);
  const height = (winH.value / bodyH.value) * winH.value;
  y.value += (deltaY / (winH.value - height)) * (bodyH.value - winH.value);
};
const yDragging = shallowRef(false);
let lastYEvent: MouseEvent | undefined = undefined;
const pointerdownY = (e: MouseEvent) => {
  lastYEvent = e;
  yDragging.value = true;
};
useEventListener('pointermove', (e) => {
  if (!lastYEvent) return;
  const deltaY = e.clientY - lastYEvent.clientY;
  lastYEvent = e;
  const height = (winH.value / bodyH.value) * winH.value;
  y.value += (deltaY / (winH.value - height)) * (bodyH.value - winH.value);
});
useEventListener('pointerup', () => {
  lastYEvent = undefined;
  yDragging.value = false;
});

const xShow = computed(() => bodyW.value > winW.value);
const xWidth = computed(() => {
  return (winW.value / bodyW.value) * winW.value;
});
const translateX = computed(() => {
  const width = xWidth.value;
  return (x.value / (bodyW.value - winW.value)) * (winW.value - width);
});
const xStyle = computed<CSSProperties>(() => {
  if (!xShow.value) return {};
  return {
    transform: `translateX(${translateX.value}px)`,
    width: `${xWidth.value}px`,
  };
});

const clickBoxX = (e: MouseEvent) => {
  const deltaX =
    xWidth.value * 0.9 * (e.clientX < xWidth.value + translateX.value ? -1 : 1);

  const width = (winW.value / bodyW.value) * winW.value;
  const newX =
    x.value + (deltaX / (winW.value - width)) * (bodyW.value - winW.value);
  x.value = newX;
};
const xDragging = shallowRef(false);
let lastXEvent: MouseEvent | undefined = undefined;
const pointerdownX = (e: MouseEvent) => {
  lastXEvent = e;
  xDragging.value = true;
};
useEventListener('pointermove', (e) => {
  if (!lastXEvent) return;
  const deltaX = e.clientX - lastXEvent.clientX;
  lastXEvent = e;

  const width = (winW.value / bodyW.value) * winW.value;
  x.value += (deltaX / (winW.value - width)) * (bodyW.value - winW.value);
});
useEventListener('pointerup', () => {
  lastXEvent = undefined;
  xDragging.value = false;
});

useEventListener('selectstart', (e) => {
  if (lastXEvent || lastYEvent) {
    e.preventDefault();
  }
});
const bodyHoverd = useElementHover(document.body);
</script>
<template>
  <div v-if="yShow || xShow" class="BodyScrollbar" fixed z-2000>
    <div
      v-if="yShow"
      scrollbar-y
      fixed
      right-2px
      top-0
      bottom-0
      w-8px
      :data-win-h="winH"
      :data-body-h="bodyW"
      @pointerdown="pointerdownY"
      @click="clickBoxY"
    >
      <div
        w-full
        rounded-4px
        transition-colors
        bg="#9093994c"
        hover:bg="#9093997f"
        :style="yStyle"
        :class="{
          'bg-#9093997f': yDragging,
          'bg-#0000!': !bodyHoverd,
        }"
        @click.stop
      />
    </div>
    <div
      v-if="xShow"
      scrollbar-x
      fixed
      bottom-2px
      left-0
      right-0
      h-8px
      :data-win-w="winW"
      :data-body-w="bodyW"
      @pointerdown="pointerdownX"
      @click="clickBoxX"
    >
      <div
        h-full
        rounded-4px
        transition-colors
        bg="#9093994c"
        hover:bg="#9093997f"
        :style="xStyle"
        :class="{
          'bg-#9093997f': xDragging,
          'bg-#0000!': !bodyHoverd,
        }"
        @click.stop
      />
    </div>
  </div>
</template>
<style>
body:not(.mobile)::-webkit-scrollbar {
  display: none;
}
html:not(.mobile) {
  scrollbar-width: none;
}
</style>
