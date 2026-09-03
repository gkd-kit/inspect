<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import { useTextViewerState } from './context';

const { copyable, copyText } = useTextViewerState();
</script>

<template>
  <NButton
    v-if="copyable"
    quaternary
    circle
    size="small"
    class="absolute right-16px top-8px z-3 border border-[#e2e8f0] bg-white/92 shadow-[0_1px_3px_rgb(15_23_42_/_12%)] backdrop-blur-4px"
    title="复制当前文件内容"
    aria-label="复制当前文件内容"
    @click="copyText"
  >
    <template #icon>
      <GkSvg name="copy" />
    </template>
  </NButton>
</template>
