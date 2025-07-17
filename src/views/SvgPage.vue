<script setup lang="ts">
import { message } from '@/utils/discrete';

const getIds = () => {
  return Array.from(
    document.querySelectorAll('#__svg_icon_container__ > *'),
  ).map((v) => v.getAttribute('id')!.substring('svg-icon-'.length));
};

const svgIds = ref(getIds());

const observer = new MutationObserver(() => {
  svgIds.value = getIds();
});
onMounted(() => {
  observer.observe(
    document.querySelector('#__svg_icon_container__') as HTMLElement,
    {
      attributes: true,
    },
  );
});
onUnmounted(() => {
  observer.disconnect();
});

const search = ref('');
const filterSvgIds = computed(() => {
  if (!search.value.trim()) return svgIds.value;
  return svgIds.value.filter((x) => x.includes(search.value));
});

const getTitle = (svgId: string) => `<SvgIcon name="${svgId}" />`;
const source = ref('');
const clipboard = useClipboard({ source, legacy: true });
const copy = async (text: string) => {
  await clipboard.copy(text);
  message.success('复制成功');
};
</script>
<template>
  <div class="SvgPage">
    <div px-16px pt-16px flex items-center gap-16px>
      <NInput
        v-model="search"
        :style="{ width: '320px' }"
        placeholder="请输入图标名称"
      />
      <div>共存在 {{ svgIds.length }} 个图标</div>
    </div>
    <div
      p-16px
      grid
      gap-24px
      justify-between
      style="grid-template-columns: repeat(auto-fill, 150px)"
    >
      <div
        v-for="svgId in filterSvgIds"
        :key="svgId"
        py-4px
        flex
        flex-col
        gap-4px
        items-center
        b-b-solid
        b-1px
        class="bg-[#f9f9f9]"
        :title="getTitle(svgId)"
        @click="copy(getTitle(svgId))"
      >
        <SvgIcon
          :name="svgId"
          class="text-32px color-[#575bca] flex-shrink-0"
        />
        <div
          px-4px
          text-12px
          break-all
          :title="svgId"
          @click.stop="copy(svgId)"
        >
          {{ svgId }}
        </div>
      </div>
    </div>
  </div>
</template>
