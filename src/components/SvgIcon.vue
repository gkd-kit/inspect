<script lang="ts">
const modules: Record<string, { default: string }> = import.meta.glob(
  '@/assets/svg/*.svg',
  {
    eager: true,
    query: 'raw',
  },
);

const svgElMap = (() => {
  return Object.fromEntries(
    Object.entries(modules).map(([k, v]) => {
      const svgName = k.split('/').at(-1)!.split('.')[0];
      const t = document.createElement('template');
      t.innerHTML = v.default;
      return [svgName, t.content.firstChild as SVGSymbolElement | null];
    }),
  );
})();
</script>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string;
  }>(),
  {},
);

const svgEl = computed(() => svgElMap[props.name]);
const actualEl = shallowRef<SVGSVGElement>();
watchEffect(() => {
  const s = svgEl.value;
  const a = actualEl.value;
  if (!s || !a) return;
  a.replaceChildren(...Array.from(s.cloneNode(true).childNodes));
});
</script>
<template>
  <svg
    v-if="svgEl"
    ref="actualEl"
    class="SvgIcon"
    :name="name"
    :viewBox="svgEl.getAttributeNS(null, 'viewBox') || undefined"
    :fill="svgEl.getAttribute('fill') || undefined"
  ></svg>
</template>
<style>
:root {
  --svg-h: 1em;
}
.SvgIcon {
  display: block;
  overflow: hidden;
  fill: currentColor;
  height: var(--svg-h);
}
/* --svg-h:initial */
</style>
