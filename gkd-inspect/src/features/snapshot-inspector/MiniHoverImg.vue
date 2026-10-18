<script lang="ts" setup>
import { useSharedSnapshotHoverImg, useSnapshotStore } from './snapshot';

const { screenshotUrl } = useSnapshotStore();
const {
  imgHover,
  imgBounding,
  hoverPositionStyle,
  boxHoverPosition,
  hoverPosition,
  boxHoverPerPosition,
} = useSharedSnapshotHoverImg();
</script>

<template>
  <!-- Teleport 需要单独一个组件否则 hmr 错误 -->
  <Teleport v-if="screenshotUrl" to="body">
    <!-- 渲染在外部防止被遮挡 -->
    <div
      v-show="imgHover"
      :style="{
        left: imgBounding.right.value + 4 + 'px',
        top: imgBounding.top.value + 'px',
      }"
      class="MiniHoverImg border-(--app-border)! bg-(--app-panel)! text-(--app-text) pointer-events-none fixed overflow-hidden z-2 h-[200px] w-[200px] border-[1px] border-indigo-600 border-dashed"
    >
      <img
        :src="screenshotUrl"
        :style="hoverPositionStyle"
        class="max-w-none! object-contain absolute left-0 top-0"
      />
      <div
        class="leading-[1] bg-[rgba(256,256,256,0.7)] absolute left-[2px] top-[2px] p-[1px] z-1 text-[13px]"
      >
        {{ `${hoverPosition.ox.toFixed(0)}, ${hoverPosition.oy.toFixed(0)}` }}
      </div>
      <div
        v-if="boxHoverPosition"
        class="leading-[1] bg-[rgba(256,256,256,0.7)] absolute left-[2px] bottom-[2px] p-[1px] z-1 text-[12px] flex flex-col items-center"
      >
        <div>{{ boxHoverPosition.top.toFixed(0) }}</div>
        <div>
          {{
            boxHoverPosition.left.toFixed(0) +
            ', ' +
            boxHoverPosition.right.toFixed(0)
          }}
        </div>
        <div>{{ boxHoverPosition.bottom.toFixed(0) }}</div>
      </div>
      <div
        v-if="boxHoverPerPosition"
        class="leading-[1] bg-[rgba(256,256,256,0.7)] absolute right-[2px] bottom-[2px] p-[1px] z-1 text-[12px] flex flex-col items-center"
      >
        <div>{{ boxHoverPerPosition.top }}</div>
        <div>
          {{ boxHoverPerPosition.left + ', ' + boxHoverPerPosition.right }}
        </div>
        <div>{{ boxHoverPerPosition.bottom }}</div>
      </div>
      <div
        class="top-[calc(50%-1px)] bg-[length:10px_1px] absolute left-0 right-0 h-[1px] bg-repeat-x mix-blend-difference"
        style="
          background-image: linear-gradient(
            to left,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );
          background-position-x: 1.5px;
        "
      />
      <div
        class="left-[calc(50%-1px)] bg-[length:1px_10px] absolute top-0 bottom-0 w-[1px] bg-repeat-y mix-blend-difference"
        style="
          background-image: linear-gradient(
            to top,
            transparent 0%,
            transparent 50%,
            #fff 50%,
            #fff 100%
          );
          background-position-y: 1.5px;
        "
      />
    </div>
  </Teleport>
</template>
