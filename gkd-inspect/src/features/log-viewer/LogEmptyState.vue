<script setup lang="ts">
import { NSpin } from 'naive-ui';

import GkSvg from '@/shared/ui/GkSvg.vue';
defineProps<{ loading: boolean }>();
defineEmits<{ open: [] }>();
</script>

<template>
  <div name="log-empty-state" class="grid min-h-0 flex-1 place-items-center">
    <NSpin :show="loading">
      <div
        name="drop-zone"
        class="box-border h-[300px] w-[620px] flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-[#94a3b8] border-dashed bg-white transition-colors duration-200 hover:border-[#18a058]"
        @click="$emit('open')"
      >
        <GkSvg name="import" class="mb-[18px] h-[48px] w-[48px]" />
        <div name="drop-title" class="text-[20px] font-semibold">
          {{ loading ? '正在下载并解析日志包…' : '拖拽 ZIP 到这里' }}
        </div>
        <div name="drop-description" class="mt-[8px] text-[#64748b]">
          或点击选择本地 ZIP 文件
        </div>
      </div>
    </NSpin>
  </div>
</template>
