<script setup lang="ts">
import dayjs from 'dayjs';
import MiniHoverImg from './MiniHoverImg.vue';

const snapshotStore = useSnapshotStore();
const { updatePosition } = snapshotStore;
const snapshotRefs = storeToRefs(snapshotStore);
const { focusNode, screenshotUrl } = snapshotRefs;

const snapshot = computed(() => snapshotStore.snapshot!);

const imgRef = shallowRef<HTMLImageElement>();
const imgLoadTime = shallowRef(false);

const clickImg = (ev: MouseEvent) => {
  const img = imgRef.value;
  if (!img) {
    return;
  }

  const imgRect = img.getBoundingClientRect();

  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  const offsetTop = (imgRect.height - innerHeight) / 2;

  const x = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
  const y =
    ((ev.clientY - imgRect.top - offsetTop) / innerHeight) * img.naturalHeight;

  updatePosition({ x, y });
};

const percent = (n: number) => {
  return `${n * 100}%`;
};

const imgSize = useElementSize(imgRef);

const positionStyle = computed(() => {
  const img = imgRef.value;

  const attr = focusNode.value?.attr;
  if (!focusNode.value || !img || !attr || !imgLoadTime.value) {
    return ``;
  }
  const imgWidth = imgSize.width.value;
  const imgHeight = imgSize.height.value;
  const innerHeight = (imgWidth / img.naturalWidth) * img.naturalHeight;
  return {
    left: `calc(${percent(attr.left / img.naturalWidth)} - 2px)`,
    width: `calc(${percent(
      (attr.right - attr.left) / img.naturalWidth,
    )} + 2px)`,

    top: `calc(${percent(
      ((attr.top / img.naturalHeight) * innerHeight +
        (imgHeight - innerHeight) / 2) /
        imgHeight,
    )} - 2px)`,
    height: `calc(${percent(
      (((attr.bottom - attr.top) / img.naturalHeight) * innerHeight) /
        imgHeight,
    )} + 2px)`,
  };
});
const imgHover = shallowRef(false);
const hoverPosition = shallowRef({ ox: 0, oy: 0 });
const boxHoverPosition = computed(() => {
  const attr = focusNode.value?.attr;
  if (!attr) {
    return;
  }
  const { ox, oy } = hoverPosition.value;
  return {
    left: ox - attr.left,
    right: attr.right - ox,
    top: oy - attr.top,
    bottom: attr.bottom - oy,
  };
});
const boxHoverPerPosition = computed(() => {
  const attr = focusNode.value?.attr;
  if (!attr || !boxHoverPosition.value) {
    return;
  }
  const { bottom, left, right, top } = boxHoverPosition.value;
  return {
    left: (left / (right + left)).toFixed(3),
    right: (right / (right + left)).toFixed(3),
    top: (top / (top + bottom)).toFixed(3),
    bottom: (bottom / (top + bottom)).toFixed(3),
  };
});
const hoverPositionStyle = shallowRef({ left: '0', top: '0' });

const imgMove = (ev: MouseEvent) => {
  const img = imgRef.value;
  if (!img) return;
  const imgRect = img.getBoundingClientRect();

  const innerHeight = (imgRect.width / img.naturalWidth) * img.naturalHeight;
  const offsetTop = (imgRect.height - innerHeight) / 2;

  const ox = ((ev.clientX - imgRect.left) / imgRect.width) * img.naturalWidth;
  const oy =
    ((ev.clientY - imgRect.top - offsetTop) / innerHeight) * img.naturalHeight;
  hoverPosition.value = { ox, oy };
  hoverPositionStyle.value = {
    left: (-(ox - 0.1 * img.naturalWidth) / img.naturalWidth) * 1000 + 'px',
    top: (-(oy - 0.1 * img.naturalWidth) / img.naturalWidth) * 1000 + 'px',
  };
};
</script>

<template>
  <div
    v-if="screenshotUrl"
    flex
    flex-col
    relative
    h-full
    p-2px
    box-border
    overflow-hidden
  >
    <img
      ref="imgRef"
      :src="screenshotUrl"
      @click="clickImg"
      cursor-crosshair
      object-contain
      h-full
      class="max-w-[calc(var(--gkd-w)*0.35)]"
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
        <div absolute left-0 top-0 bottom-0 right-0 b-solid b-1px b-red></div>
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
    <MiniHoverImg
      v-if="imgRef"
      :imgHover="imgHover"
      :imgRef="imgRef"
      :boxHoverPerPosition="boxHoverPerPosition"
      :boxHoverPosition="boxHoverPosition"
      :hoverPositionStyle="hoverPositionStyle"
      :hoverPosition="hoverPosition"
      :screenshotUrl="screenshotUrl"
    />
  </div>
</template>
