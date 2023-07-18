<script setup lang="ts">
import { computed, onUnmounted, shallowReactive, shallowRef, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    initialValue: {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    };
  }>(),
  { initialValue: () => ({}) },
);

const isLeft = props.initialValue.left !== void 0;
const isTop = props.initialValue.top !== void 0;

const offset = shallowReactive({
  x: (isLeft ? props.initialValue.left : props.initialValue.right) ?? 0,
  y: (isTop ? props.initialValue.top : props.initialValue.bottom) ?? 0,
});
const currentStyle = computed(() => {
  const xStyle = isLeft ? `left:${offset.x}px;` : `right:${offset.x}px;`;
  const yStyle = isTop ? `top:${offset.y}px;` : `bottom:${offset.y}px;`;
  return xStyle + yStyle;
});
let moving = false;
const startMove = () => {
  moving = true;
};
const move = (ev: PointerEvent) => {
  if (!moving) return;
  offset.x += isLeft ? ev.movementX : -ev.movementX;
  offset.y += isTop ? ev.movementY : -ev.movementY;
};
const endMove = () => {
  moving = false;
};
const target = shallowRef<HTMLElement>();

// move 事件应该给 window. 如果给目标元素,容易出现鼠标移速过快无法跟随的bug
window.addEventListener('pointermove', move);
onUnmounted(() => {
  window.removeEventListener('pointermove', move);
});
watch(target, (newValue, oldvalue) => {
  if (newValue) {
    newValue.addEventListener('pointerdown', startMove);
    newValue.addEventListener('pointerup', endMove);
  }
  if (oldvalue) {
    oldvalue.removeEventListener('pointerdown', startMove);
    oldvalue.removeEventListener('pointerup', endMove);
  }
});
onUnmounted(() => {
  if (!target.value) return;
  target.value.removeEventListener('pointerdown', startMove);
  target.value.removeEventListener('pointerup', endMove);
});
const updateTarget = (arg: unknown) => {
  if (arg instanceof HTMLElement) {
    target.value = arg;
  } else {
    target.value = void 0;
  }
};
</script>
<template>
  <Teleport to="body">
    <div
      fixed
      :style="[$attrs.style as string, currentStyle]"
      :class="$attrs.class"
    >
      <slot :onRef="updateTarget"></slot>
    </div>
  </Teleport>
</template>
