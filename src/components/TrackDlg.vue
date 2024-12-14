<script lang="ts" setup>
import { buildEmptyFn } from '@/utils/others';
import type { TrackValue } from '@/utils/types';

const AsyncTrackGraph = (() => {
  const loader = () => import('./TrackGraph.vue');
  setTimeout(loader, 1000);
  return defineAsyncComponent(loader);
})();

const props = withDefaults(
  defineProps<{
    track: TrackValue | undefined;
    onUpdateTrack?: (data?: TrackValue) => void;
  }>(),
  {
    onUpdateTrack: buildEmptyFn,
  },
);

const show = shallowRef(false);
watchEffect(() => {
  if (props.track) {
    show.value = true;
  }
});
</script>
<template>
  <NModal
    v-model:show="show"
    preset="dialog"
    title="选择器路径视图"
    class="min-w-[calc(var(--gkd-w)*0.4)]"
    @afterLeave="onUpdateTrack()"
  >
    <template #icon>
      <NIcon>
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M5 21V8.825Q4.125 8.5 3.563 7.738T3 6q0-1.25.875-2.125T6 3q1.25 0 2.125.875T9 6q0 .975-.562 1.738T7 8.825V19h4V3h8v12.175q.875.325 1.438 1.088T21 18q0 1.25-.875 2.125T18 21q-1.25 0-2.125-.875T15 18q0-.975.563-1.75T17 15.175V5h-4v16zM6 7q.425 0 .713-.288T7 6q0-.425-.288-.712T6 5q-.425 0-.712.288T5 6q0 .425.288.713T6 7m12 12q.425 0 .713-.288T19 18q0-.425-.288-.712T18 17q-.425 0-.712.288T17 18q0 .425.288.713T18 19m0-1"
          />
        </svg>
      </NIcon>
    </template>
    <template v-if="track">
      <div class="gkd_code py-2px px-4px rounded-2px bg-[#eee]">
        {{ track.selector.toString() }}
      </div>
      <AsyncTrackGraph :track="track" />
      <div opacity-75 text-12px>*为简化视图已隐藏部分节点</div>
    </template>
  </NModal>
</template>
