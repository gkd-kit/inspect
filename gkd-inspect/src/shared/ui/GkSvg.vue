<script lang="ts">
const svgElMap = computedAsync(
  async () => (await import('@/shared/ui/icons')).default,
  {},
);
</script>
<script setup lang="ts">
const props = defineProps<{
  name: string;
}>();

const svgEl = computed(() => svgElMap.value[props.name]);
const svgAttrs = computed(() => {
  const sourceEl = svgEl.value;
  if (!sourceEl) return {};
  return Object.fromEntries(
    Array.from(sourceEl.attributes)
      .filter(({ name }) => !['xmlns', 'width', 'height'].includes(name))
      .map(({ name, value }) => [name, value]),
  );
});
const actualEl = shallowRef<SVGSVGElement>();
watchEffect(() => {
  const s = svgEl.value;
  const a = actualEl.value;
  if (!s || !a) return;
  a.replaceChildren(...s.cloneNode(true).childNodes);
});
</script>
<template>
  <svg
    v-if="svgEl"
    v-bind="svgAttrs"
    ref="actualEl"
    class="GkSvg"
    :name="name"
  ></svg>
</template>
<style>
.GkSvg {
  display: block;
  overflow: hidden;
  height: var(--svg-h, 1em);
}
.GkSvg:not([fill]) {
  fill: currentColor;
}
</style>
