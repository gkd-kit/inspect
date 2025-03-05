<script setup lang="ts">
import type { TrackCardProps } from '@/utils/types';
import TrackCard from './TrackCard.vue';
import { buildEmptyFn } from '@/utils/others';

const props = withDefaults(
  defineProps<{
    data?: TrackCardProps;
    show?: boolean;
    onUpdateShow?: (show: boolean) => void;
    onUpdateData?: (data?: TrackCardProps) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
    onUpdateData: buildEmptyFn,
  },
);

type ShowStatus = -1 | 0 | 1;

const innerShow = ref(false);
const showStatus = ref<ShowStatus>(0);
watchImmediate(
  () => props.show,
  async () => {
    if (props.show) {
      innerShow.value = true;
      showStatus.value = -1;
      await new Promise((r) => setTimeout(r, 300));
      showStatus.value = 0;
    } else {
      showStatus.value = 1;
      await new Promise((r) => setTimeout(r, 300));
      innerShow.value = false;
      showStatus.value = 0;
      props.onUpdateData();
    }
  },
);

useEventListener('keyup', (e) => {
  if (e.key === 'Escape') {
    props.onUpdateShow(false);
  }
});
</script>
<template>
  <div
    v-if="innerShow"
    class="TrackModal"
    absolute
    left-0
    top-0
    bg-white
    z-3000
    w="[--gkd-w]"
    h="[--gkd-h]"
    :class="{
      'track-model-enter': showStatus === -1,
      'track-model-exit': showStatus === 1,
    }"
  >
    <TrackCard v-if="data" v-bind="data" @close="onUpdateShow(false)" />
  </div>
</template>

<style lang="scss" scoped>
.track-model-enter {
  animation: enter-keyframes 300ms;
}
@keyframes enter-keyframes {
  0% {
    opacity: 0.5;
    transform: translateY(15%);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.track-model-exit {
  animation: exit-keyframes 300ms forwards;
}
@keyframes exit-keyframes {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(15%);
  }
}
</style>
