<script setup lang="ts">
import { NInput } from 'naive-ui';
import { computed, ref } from 'vue';
import { computedAsync, useClipboard } from '@vueuse/core';

import GkSvg from '@/shared/ui/GkSvg.vue';
import { message } from '@/shared/services/feedback';

const svgElMap = computedAsync(
  async () => (await import('@/shared/ui/icons')).default,
  {},
);
const svgIds = computed(() => Object.keys(svgElMap.value));

const search = ref('');
const filterSvgIds = computed(() => {
  if (!search.value.trim()) return svgIds.value;
  return svgIds.value.filter((x) => x.includes(search.value));
});

const getTitle = (svgId: string) => `<GkSvg name="${svgId}" />`;
const source = ref('');
const clipboard = useClipboard({ source, legacy: true });
const copy = async (text: string) => {
  await clipboard.copy(text);
  message.success('复制成功');
};
</script>
<template>
  <div class="w-(--gkd-w) h-(--gkd-h)">
    <div class="px-[16px] pt-[16px] flex items-center gap-[16px]">
      <NInput
        v-model="search"
        :style="{ width: '320px' }"
        placeholder="请输入图标名称"
      />
      <div>共存在 {{ svgIds.length }} 个图标</div>
    </div>
    <div
      class="p-[16px] grid gap-[24px] justify-between"
      style="grid-template-columns: repeat(auto-fill, 150px)"
    >
      <div
        v-for="svgId in filterSvgIds"
        :key="svgId"
        class="bg-[#f9f9f9] py-[4px] flex flex-col gap-[4px] items-center [border-bottom-style:solid] border-[1px]"
        :title="getTitle(svgId)"
        @click="copy(getTitle(svgId))"
      >
        <GkSvg :name="svgId" class="text-[32px] text-[#575bca] shrink-0" />
        <div
          class="px-[4px] text-[12px] break-all"
          :title="svgId"
          @click.stop="copy(svgId)"
        >
          {{ svgId }}
        </div>
      </div>
    </div>
  </div>
</template>
