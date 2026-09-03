<script lang="ts">
const stackIds = shallowRef<number[]>([]);
const useDialogStack = (getVisible: () => boolean) => {
  const t = Date.now();
  const clear = () => {
    stackIds.value = stackIds.value.filter((v) => v !== t);
  };
  onScopeDispose(clear);
  watchImmediate(getVisible, (v) => {
    clear();
    if (v) {
      stackIds.value = stackIds.value.concat(t);
    }
  });
  const zIndex = computed(() => {
    return 2000 + stackIds.value.indexOf(t);
  });
  const isTop = computed(() => stackIds.value.at(-1) === t);
  return {
    zIndex,
    isTop,
  };
};
</script>

<script setup lang="ts">
const show = defineModel<boolean>('show', { default: false, required: true });
const emit = defineEmits<{
  closed: [];
}>();

const actualShow = shallowRef(show.value);
const state = shallowRef<'enter' | 'leave'>(); // 第一次进入不做动画
const duration = 300;
let taskId = 0;
const clearTask = () => {
  if (taskId) {
    clearTimeout(taskId);
  }
  taskId = 0;
};
onScopeDispose(clearTask);
watch(show, (v) => {
  clearTask();
  if (v) {
    actualShow.value = true;
    state.value = 'enter';
  } else {
    state.value = 'leave';
    taskId = window.setTimeout(() => {
      actualShow.value = false;
      state.value = undefined;
      clearTask();
      emit('closed');
    }, duration);
  }
});

const { isTop, zIndex } = useDialogStack(() => actualShow.value);
useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isTop.value) {
    show.value = false;
  }
});
</script>
<template>
  <Teleport v-if="actualShow" to="body">
    <div
      class="FullScreenDialog"
      absolute
      top-0
      left-0
      page-size
      :style="{
        '--duration': duration + 'ms',
        'z-index': zIndex,
      }"
      :class="{
        'enter-active': state === 'enter',
        'exit-active': state === 'leave',
      }"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </Teleport>
</template>
<style lang="scss" scoped>
.enter-active {
  animation: enter-keyframes var(--duration) forwards;
}
@keyframes enter-keyframes {
  0% {
    opacity: 0;
    transform: translateY(-2%);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.exit-active {
  animation: exit-keyframes var(--duration) forwards;
}
@keyframes exit-keyframes {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
