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
const prevOffset = {
  x: (isLeft ? props.initialValue.left : props.initialValue.right) ?? 0,
  y: (isTop ? props.initialValue.top : props.initialValue.bottom) ?? 0,
};

const offset = shallowReactive({ ...prevOffset });
const currentStyle = computed(() => {
  const xStyle = isLeft ? `left:${offset.x}px;` : `right:${offset.x}px;`;
  const yStyle = isTop ? `top:${offset.y}px;` : `bottom:${offset.y}px;`;
  return xStyle + yStyle;
});
/**
 * it will be PointerEvent when moving
 */
let prevEv: PointerEvent | undefined = undefined;
const startMove = (ev: PointerEvent) => {
  prevEv = ev;
  prevOffset.x = offset.x;
  prevOffset.y = offset.y;
};
const move = (ev: PointerEvent) => {
  if (!target.value || !prevEv) return;

  const dx = ev.clientX - prevEv.clientX; // ev.movementX;
  const dy = ev.clientY - prevEv.clientY; //ev.movementY;

  offset.x = prevOffset.x + (isLeft ? dx : -dx);
  offset.y = prevOffset.y + (isTop ? dy : -dy);
};
const endMove = () => {
  prevEv = undefined;
};
const box = shallowRef<HTMLElement>();
const target = shallowRef<HTMLElement>();
const preventSelection = (ev: Event) => {
  if (prevEv) {
    ev.preventDefault();
  }
};
const transitions = [`transition-top,bottom,left,right-500`];
const windowEndMove = () => {
  if (!target.value) return;
  const { top, bottom, left, right } = target.value.getBoundingClientRect();
  if (
    right < 0 ||
    left > window.innerWidth ||
    bottom < 0 ||
    top > window.innerHeight
  ) {
    // isOutsideViewport
    offset.x = prevOffset.x;
    offset.y = prevOffset.y;
    endMove();

    const boxDiv = box.value;
    if (boxDiv) {
      boxDiv.classList.add(...transitions);
      setTimeout(() => {
        boxDiv.classList.remove(...transitions);
      }, 550);
    }
  }
};

// move 事件应该给 window. 如果给目标元素,容易出现鼠标移速过快无法跟随的bug
window.addEventListener('pointermove', move);
window.addEventListener('pointerup', windowEndMove);
document.addEventListener('selectstart', preventSelection);
onUnmounted(() => {
  window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', windowEndMove);
  document.removeEventListener('selectstart', preventSelection);
  endMove();
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
  <Teleport to="#app">
    <div
      fixed
      ref="box"
      :style="[$attrs.style as string, currentStyle]"
      :class="$attrs.class"
    >
      <slot :onRef="updateTarget"></slot>
    </div>
  </Teleport>
</template>
