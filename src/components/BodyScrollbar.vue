<script setup lang="ts">
import type { CSSProperties } from 'vue';

const { y, x } = useWindowScroll();
const { height: winH, width: winW } = useWindowSize();
const body = useElementBounding(document.body);

const yShow = computed(() => body.height.value > winH.value);
const yHeight = computed(() => {
  const clientHeight = body.height.value;
  const bodyHeight = clientHeight;
  return (winH.value / bodyHeight) * winH.value;
});
const translateY = computed(() => {
  const clientHeight = body.height.value;
  const height = yHeight.value;
  return (y.value / (clientHeight - winH.value)) * (winH.value - height);
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
  const clientHeight = body.height.value;
  const bodyHeight = clientHeight;
  const height = (winH.value / bodyHeight) * winH.value;
  y.value += (deltaY / (winH.value - height)) * (clientHeight - winH.value);
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
  const clientHeight = body.height.value;
  const bodyHeight = clientHeight;
  const height = (winH.value / bodyHeight) * winH.value;
  y.value += (deltaY / (winH.value - height)) * (clientHeight - winH.value);
});
useEventListener('pointerup', () => {
  lastYEvent = undefined;
  yDragging.value = false;
});

// 不知道为什么 body_width 比 win_width 多出 0.2 或 0.4, 使用 Math.floor 去除
const xShow = computed(() => Math.floor(body.width.value) > winW.value);
const xWidth = computed(() => {
  const clientWidth = body.width.value;
  const bodyWidth = clientWidth;
  return (winW.value / bodyWidth) * winW.value;
});
const translateX = computed(() => {
  const clientWidth = body.width.value;
  const width = xWidth.value;
  return (x.value / (clientWidth - winW.value)) * (winW.value - width);
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
  const clientWidth = body.width.value;
  const bodyWidth = clientWidth;
  const width = (winW.value / bodyWidth) * winW.value;
  const newX =
    x.value + (deltaX / (winW.value - width)) * (clientWidth - winW.value);
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
  const clientWidth = body.width.value;
  const bodyWidth = clientWidth;
  const width = (winW.value / bodyWidth) * winW.value;
  x.value += (deltaX / (winW.value - width)) * (clientWidth - winW.value);
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
</script>
<template>
  <div fixed z-2000 class="BodyScrollbar">
    <div
      v-show="yShow"
      scrollbar-y
      fixed
      right-2px
      top-0
      bottom-0
      w-8px
      @pointerdown="pointerdownY"
      @click="clickBoxY"
    >
      <div
        @click.stop
        w-full
        bg="#909399"
        opacity-30
        hover:opacity="50"
        :style="yStyle"
        :class="{
          'opacity-50': yDragging,
        }"
      ></div>
    </div>
    <div
      v-if="xShow"
      scrollbar-x
      fixed
      bottom-2px
      left-0
      right-0
      h-8px
      @pointerdown="pointerdownX"
      @click="clickBoxX"
    >
      <div
        @click.stop
        h-full
        bg="#909399"
        opacity-30
        hover:opacity="50"
        :style="xStyle"
        :class="{
          'opacity-50': xDragging,
        }"
      ></div>
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
