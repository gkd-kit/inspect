<script setup lang="ts">
import { useDragMove } from '@/utils/draggable';
import {
  computed,
  onMounted,
  onUnmounted,
  shallowReactive,
  shallowRef,
  watch,
} from 'vue';

const props = withDefaults(
  defineProps<{
    initialValue: {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;

      width?: number;
    };
    minWidth?: number;
    sizeDraggable?: boolean;
    disabled?: boolean;
  }>(),
  { initialValue: () => ({}) },
);

const isLeft = props.initialValue.left !== void 0;
const isTop = props.initialValue.top !== void 0;
const prevOffset = {
  x: (isLeft ? props.initialValue.left : props.initialValue.right) ?? 0,
  y: (isTop ? props.initialValue.top : props.initialValue.bottom) ?? 0,
};

const leftDragBar = useDragMove((dx) => {
  const w =
    (props.initialValue.width || 0) +
    rightDragBar.offset.x +
    -leftDragBar.offset.x -
    dx;
  return (props.minWidth || 0) < w;
});
const rightDragBar = useDragMove((dx) => {
  const w =
    (props.initialValue.width || 0) +
    rightDragBar.offset.x +
    dx -
    leftDragBar.offset.x;

  return (props.minWidth || 0) < w;
});

const offset = shallowReactive({ ...prevOffset });
const currentStyle = computed(() => {
  const width =
    (props.initialValue.width || 0) +
    rightDragBar.offset.x -
    leftDragBar.offset.x;
  const widthStyle = props.initialValue.width ? `width:${width}px;` : ``;
  const yStyle = isTop ? `top:${offset.y}px;` : `bottom:${offset.y}px;`;
  if (isLeft) {
    return `left:${offset.x - leftDragBar.offset.x}px;` + yStyle + widthStyle;
  } else {
    return `right:${offset.x - rightDragBar.offset.x}px;` + yStyle + widthStyle;
  }
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
const transition = `transition-top,bottom,left,right-500`;
const windowEndMove = () => {
  if (!target.value || !prevEv) return;
  endMove();
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

    const boxDiv = box.value;
    if (boxDiv) {
      boxDiv.classList.add(transition);
      setTimeout(() => {
        boxDiv.classList.remove(transition);
      }, 550);
    }
  }
};

// move 事件应该给 window. 如果给目标元素,容易出现鼠标移速过快无法跟随的bug
onMounted(() => {
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', windowEndMove);
  document.addEventListener('selectstart', preventSelection);
});
onUnmounted(() => {
  window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', windowEndMove);
  document.removeEventListener('selectstart', preventSelection);
  endMove();
});

watch(target, (newValue, oldValue) => {
  if (newValue) {
    newValue.addEventListener('pointerdown', startMove);
    newValue.addEventListener('pointerup', endMove);
  }
  if (oldValue) {
    oldValue.removeEventListener('pointerdown', startMove);
    oldValue.removeEventListener('pointerup', endMove);
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
  <Teleport to="#app" :disabled="disabled">
    <div
      fixed
      ref="box"
      :style="[$attrs.style as string, currentStyle]"
      :class="$attrs.class"
    >
      <slot :onRef="updateTarget"></slot>

      <template v-if="sizeDraggable">
        <div
          :ref="leftDragBar.target"
          absolute
          right-full
          top-0
          bottom-0
          w-5px
          cursor-ew-resize
        ></div>
        <div
          :ref="rightDragBar.target"
          absolute
          left-full
          top-0
          bottom-0
          w-5px
          cursor-ew-resize
        ></div>
      </template>
    </div>
  </Teleport>
</template>
