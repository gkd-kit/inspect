<script setup lang="ts">
import dayjs from 'dayjs';
import MiniHoverImg from './MiniHoverImg.vue';
import { useSharedSnapshotHoverImg, useSnapshotStore } from './snapshot';

const { screenshotUrl, snapshot } = useSnapshotStore();
const { clickImg, imgHover, imgMove, imgLoadTime, positionStyle, imgRef } =
  useSharedSnapshotHoverImg();
</script>

<template>
  <div
    v-if="snapshot && screenshotUrl"
    flex
    flex-col
    relative
    h-full
    p-2px
    overflow-hidden
  >
    <img
      ref="imgRef"
      :src="screenshotUrl"
      cursor-crosshair
      object-contain
      h-full
      class="max-w-[calc(var(--gkd-w)*0.35)]"
      @click="clickImg"
      @mouseover="imgHover = true"
      @mouseleave="imgHover = false"
      @mousemove="imgMove"
      @load="imgLoadTime = true"
    />
    <div pointer-events-none absolute left-2px top-2px size="[calc(100%-4px)]">
      <div
        :style="positionStyle"
        absolute
        transition-all-300
        b-1px
        b-blue
        b-solid
      >
        <div absolute left-0 top-0 bottom-0 right-0 b-solid b-1px b-red />
      </div>
    </div>
    <div
      absolute
      z-4
      pointer-events-none
      left-4px
      top-4px
      text-12px
      leading="100%"
      flex
      gap-4px
    >
      <div py-1px px-2px bg="#ffffff90" title="尺寸">
        {{ `${snapshot.screenWidth}x${snapshot.screenHeight}` }}
      </div>
      <div py-1px px-2px bg="#ffffff90" title="创建时间">
        {{ dayjs(snapshot.id).format('YYYY-MM-DD HH:mm:ss') }}
      </div>
    </div>
    <MiniHoverImg v-if="imgRef" />
  </div>
</template>
