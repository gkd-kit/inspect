<script setup lang="ts">
const snapshotStore = useSnapshotStore();
const { updatePosition } = snapshotStore;
const snapshotRefs = storeToRefs(snapshotStore);
const { focusNode, screenshotUrl } = snapshotRefs;

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

const imgBounding = useElementBounding(imgRef);
</script>

<template>
  <div flex flex-col relative h-full v-if="screenshotUrl">
    <img
      ref="imgRef"
      :src="screenshotUrl"
      @click="clickImg"
      cursor-crosshair
      h-full
      object-contain
      class="max-w-[calc(var(--gkd-w)*0.35)]"
      @mouseover="imgHover = true"
      @mouseleave="imgHover = false"
      @mousemove="imgMove"
      @load="imgLoadTime = true"
    />
    <div
      :style="positionStyle"
      absolute
      pointer-events-none
      transition-all-300
      b-1px
      b-blue
      b-solid
    >
      <div absolute left-0 top-0 bottom-0 right-0 b-solid b-1px b-red></div>
    </div>
    <Teleport to="body">
      <!-- 渲染在外部防止被遮挡 -->
      <div
        v-show="imgHover"
        :style="{
          left: imgBounding.right.value + 4 + 'px',
          top: imgBounding.top.value + 'px',
        }"
        pointer-events-none
        fixed
        overflow-hidden
        z-2
        bg-white
        h-200px
        w-200px
        border-1px
        border-indigo-600
        border-dashed
      >
        <img
          :src="screenshotUrl"
          object-contain
          absolute
          left-0
          top-0
          :style="hoverPositionStyle"
          w-1000px
        />
        <div
          absolute
          left-2px
          top-2px
          p-1px
          z-1
          text-13px
          class="leading-[1] bg-[rgba(256,256,256,0.7)]"
        >
          {{ `${hoverPosition.ox.toFixed(0)},${hoverPosition.oy.toFixed(0)}` }}
        </div>
        <div
          v-if="boxHoverPosition"
          absolute
          left-2px
          bottom-2px
          p-1px
          z-1
          text-12px
          class="leading-[1] bg-[rgba(256,256,256,0.7)]"
          flex
          flex-col
          flex-items-center
        >
          <div>{{ boxHoverPosition.top.toFixed(0) }}</div>
          <div>
            {{
              boxHoverPosition.left.toFixed(0) +
              ',' +
              boxHoverPosition.right.toFixed(0)
            }}
          </div>
          <div>{{ boxHoverPosition.bottom.toFixed(0) }}</div>
        </div>
        <div
          v-if="boxHoverPerPosition"
          absolute
          right-2px
          bottom-2px
          p-1px
          z-1
          text-12px
          class="leading-[1] bg-[rgba(256,256,256,0.7)]"
          flex
          flex-col
          flex-items-center
        >
          <div>{{ boxHoverPerPosition.top }}</div>
          <div>
            {{ boxHoverPerPosition.left + ',' + boxHoverPerPosition.right }}
          </div>
          <div>{{ boxHoverPerPosition.bottom }}</div>
        </div>
        <div
          class="top-[calc(50%-1px)] bg-[length:10px_1px]"
          absolute
          left-0
          right-0
          h-1px
          bg-repeat-x
          mix-blend-difference
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
        ></div>
        <div
          class="left-[calc(50%-1px)] bg-[length:1px_10px]"
          absolute
          top-0
          bottom-0
          w-1px
          bg-repeat-y
          mix-blend-difference
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
        ></div>
      </div>
    </Teleport>
  </div>
</template>
