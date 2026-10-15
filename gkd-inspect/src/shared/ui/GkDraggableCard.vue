<script setup lang="ts">
import {
  getDraggableViewportCorrection,
  getDraggableViewportWidth,
  useDragMove,
  useZindex,
  type GkDraggableCardValue,
} from './GkDraggableCard.ts';

const props = withDefaults(
  defineProps<{
    initialValue?: GkDraggableCardValue;
    minWidth?: number;
    sizeDraggable?: boolean;
    show?: boolean;
    class?: string;
  }>(),
  { initialValue: () => ({}), show: true },
);

const emit = defineEmits<{
  'update:value': [value: GkDraggableCardValue];
}>();

const initialValue = { ...props.initialValue };
const isLeft = initialValue.left !== void 0;
const isTop = initialValue.top !== void 0;
const prevOffset = {
  x: (isLeft ? initialValue.left : initialValue.right) ?? 0,
  y: (isTop ? initialValue.top : initialValue.bottom) ?? 0,
};

const getCurrentWidth = () =>
  (initialValue.width ?? 0) + rightDragBar.offset.x - leftDragBar.offset.x;
const getCurrentValue = (): GkDraggableCardValue => {
  const value: GkDraggableCardValue = {};
  value[isLeft ? 'left' : 'right'] =
    offset.x - (isLeft ? leftDragBar.offset.x : rightDragBar.offset.x);
  value[isTop ? 'top' : 'bottom'] = offset.y;
  if (initialValue.width !== undefined) {
    value.width = getCurrentWidth();
  }
  return value;
};
const emitCurrentValue = () => {
  emit('update:value', getCurrentValue());
};

const leftDragBar = useDragMove((dx) => {
  const width = getCurrentWidth() - dx;
  return (props.minWidth ?? 0) < width;
}, emitCurrentValue);
const rightDragBar = useDragMove((dx) => {
  const width = getCurrentWidth() + dx;
  return (props.minWidth ?? 0) < width;
}, emitCurrentValue);

const offset = shallowReactive({ ...prevOffset });
const currentStyle = computed(() => {
  const widthStyle =
    initialValue.width !== undefined ? `width:${getCurrentWidth()}px;` : ``;
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
const moved = shallowRef(false);
const startMove = (ev: PointerEvent) => {
  prevEv = ev;
  prevOffset.x = offset.x;
  prevOffset.y = offset.y;
  moved.value = false;
};
const move = (ev: PointerEvent) => {
  if (!target.value || !prevEv) return;

  const dx = ev.clientX - prevEv.clientX; // ev.movementX;
  const dy = ev.clientY - prevEv.clientY; //ev.movementY;

  offset.x = prevOffset.x + (isLeft ? dx : -dx);
  offset.y = prevOffset.y + (isTop ? dy : -dy);

  moved.value = true;
};
const cancelMove = () => {
  prevEv = undefined;
};
const box = shallowRef<HTMLElement>();
const target = shallowRef<HTMLElement>();
const constrainPositionToViewport = () => {
  if (!target.value) return;
  const correction = getDraggableViewportCorrection(
    target.value.getBoundingClientRect(),
    { width: window.innerWidth, height: window.innerHeight },
  );
  offset.x += isLeft ? correction.x : -correction.x;
  offset.y += isTop ? correction.y : -correction.y;
};
const constrainToViewport = () => {
  if (!target.value || !props.show) return;
  if (initialValue.width !== undefined) {
    const currentWidth = getCurrentWidth();
    const nextWidth = getDraggableViewportWidth(
      currentWidth,
      window.innerWidth,
      props.minWidth,
    );
    const widthDelta = nextWidth - currentWidth;
    if (widthDelta) {
      if (isLeft) rightDragBar.offset.x += widthDelta;
      else leftDragBar.offset.x -= widthDelta;
      void nextTick(constrainPositionToViewport);
      return;
    }
  }
  constrainPositionToViewport();
};
const preventSelection = (ev: Event) => {
  if (prevEv) {
    ev.preventDefault();
  }
};
const transition = `transition-top,bottom,left,right-500`;
const endMove = () => {
  if (!target.value || !prevEv) return;
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
  cancelMove();
  emitCurrentValue();
};

// move 事件应该给 window. 如果给目标元素,容易出现鼠标移速过快无法跟随的bug
onMounted(() => {
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', endMove);
  window.addEventListener('resize', constrainToViewport);
  document.addEventListener('selectstart', preventSelection);
});
onUnmounted(() => {
  window.removeEventListener('pointermove', move);
  window.removeEventListener('pointerup', endMove);
  window.removeEventListener('resize', constrainToViewport);
  document.removeEventListener('selectstart', preventSelection);
  target.value?.removeEventListener('pointerdown', startMove);
  cancelMove();
});

watch(target, (newValue, oldValue) => {
  if (newValue) {
    newValue.addEventListener('pointerdown', startMove);
    void nextTick(constrainToViewport);
  }
  if (oldValue) {
    oldValue.removeEventListener('pointerdown', startMove);
  }
});
const updateTarget = (arg: unknown) => {
  if (arg instanceof HTMLElement) {
    target.value = arg;
  } else {
    target.value = void 0;
  }
};

const { setTop, zIndex } = useZindex();
watch(
  () => props.show,
  () => {
    if (props.show) {
      setTop();
    }
  },
);
</script>
<template>
  <Teleport to="body">
    <Transition name="draggable-card" appear>
      <div
        v-if="show"
        ref="box"
        fixed
        class="GkDraggableCard"
        :style="[currentStyle, { zIndex }]"
        :class="props.class"
        @mousedown="setTop"
      >
        <slot :onRef="updateTarget" :moved="moved" />

        <template v-if="sizeDraggable">
          <div
            :ref="leftDragBar.target"
            absolute
            right-full
            top-0
            bottom-0
            w-5px
            cursor-ew-resize
          />
          <div
            :ref="rightDragBar.target"
            absolute
            left-full
            top-0
            bottom-0
            w-5px
            cursor-ew-resize
          />
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.draggable-card-enter-active,
.draggable-card-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}

.draggable-card-leave-active {
  pointer-events: none;
}

.draggable-card-enter-from,
.draggable-card-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .draggable-card-enter-active,
  .draggable-card-leave-active {
    transition-duration: 1ms;
  }
}
</style>
