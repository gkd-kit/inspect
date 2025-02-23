<script lang="ts">
const modules: Record<string, { default: string }> = import.meta.glob(
  '@/assets/svg/*.svg',
  {
    eager: true,
    query: 'raw',
  },
);
const svgContainerId = '__svg_icon_container__';
const svgIconContainerEl =
  document.body.querySelector<HTMLElement>('#' + svgContainerId) ||
  (() => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('id', svgContainerId);
    el.style.position = 'absolute';
    el.style.width = '0';
    el.style.height = '0';
    document.body.insertBefore(el, document.body.firstChild);
    return el;
  })();
if (svgIconContainerEl.children.length) {
  svgIconContainerEl.innerHTML = '';
}

const symbolIdPrefix = 'svg-icon-';
const domParser = new DOMParser();
const keepAttrs = ['viewBox'];
const svgIconMap = Object.fromEntries(
  Object.entries(modules)
    .filter(([_, v]) => v.default.trim())
    .map(([k, v]) => [k.split('/').at(-1)!.split('.')[0], v.default])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([svgName, svgText]) => {
      if (!svgText.includes(`xmlns="http://www.w3.org/2000/svg"`)) {
        svgText = svgText
          .trimStart()
          .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const svgEl = domParser.parseFromString(
        svgText,
        'image/svg+xml',
      ).documentElement;
      const symbolEl = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'symbol',
      );
      symbolEl.setAttribute('id', symbolIdPrefix + svgName);
      keepAttrs.forEach((k) => {
        const v = svgEl.getAttribute(k);
        if (v) {
          symbolEl.setAttributeNS(null, k, v);
        }
      });
      Array.from(svgEl.children).forEach((v) => {
        symbolEl.appendChild(v);
      });
      return [svgName, symbolEl];
    }),
);
Object.values(svgIconMap).forEach((v) => {
  svgIconContainerEl.appendChild(v);
});
svgIconContainerEl.setAttribute('data-update-time', Date.now().toString());
</script>
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    name: string;
    h?: string;
  }>(),
  {},
);

const hrefId = computed(() => {
  return '#' + symbolIdPrefix + props.name;
});

const viewBox = computed(() => {
  return svgIconMap[props.name]?.getAttribute('viewBox') || undefined;
});
</script>
<template>
  <svg
    v-if="name"
    class="svg-icon"
    :data-name="name"
    :viewBox="viewBox"
    :style="{
      '--svg-h': props.h,
    }"
  >
    <use :xlink:href="hrefId" />
  </svg>
</template>
<style>
.svg-icon {
  display: block;
  overflow: hidden;
  fill: currentColor;
  height: var(--svg-h, 1em);
}
</style>
