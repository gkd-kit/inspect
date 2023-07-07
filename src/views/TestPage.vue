<script setup lang="ts">
import { Directive, nextTick, onMounted, ref, watchEffect } from 'vue';

const child = ref<HTMLElement[]>();
const weakset = new WeakSet<HTMLElement>();
watchEffect(() => {
  if (!child.value) return;
  const children = child.value;
  children.forEach((div) => {
    if (weakset.has(div)) return;
    weakset.add(div);
    const parent = div.parentElement! as HTMLElement & { __factor: number };
    parent.__factor = 1;
    const resize = () => {
      console.log(div);
      if (parent.scrollWidth > parent.clientWidth) {
        parent.__factor++;
        parent.style.width = `calc(100% / 6 * ${parent.__factor})`;
      }
    };
    div.addEventListener('resize', resize);
    resize();
  });
});

const vResize: Directive<HTMLElement & { __factor: number }> = {
  async updated(div) {
    console.log(div);
    await nextTick();
    div.__factor ??= 1;
    if (div.scrollWidth > div.clientWidth) {
      div.__factor++;
      div.style.width = `calc(100% / 6 * ${div.__factor})`;
    }
  },
  // mounted(div) {
  // },
  beforeUpdate(div) {
    console.log(div);
  },
};

const text = ref(``);
setTimeout(() => {
  text.value = `z`.repeat(100);
}, 2000);
</script>
<template>
  <div flex flex-wrap w-full>
    <div
      v-for="i in 9"
      :key="i"
      class="w-1/6"
      border-1px
      border-solid
      border-black
      box-border
      flex
      flex-col
      v-resize
    >
      hello{{ i }}
      <div v-if="i == 1">{{ text }}</div>
      <div v-if="i == 4" w-400px>zzzz</div>
      <div v-if="i == 5" w-350px>zzzz</div>
    </div>
  </div>
</template>
