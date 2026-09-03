<script setup lang="ts">
defineProps<{ loading: boolean }>();
defineEmits<{ open: [] }>();
</script>

<template>
  <div name="log-empty-state" class="grid min-h-0 flex-1 place-items-center">
    <NSpin :show="loading">
      <div
        name="drop-zone"
        class="box-border h-300px w-620px flex cursor-pointer flex-col items-center justify-center rounded-12px border-2 border-[#94a3b8] border-dashed bg-white transition-colors duration-200 hover:border-[#18a058]"
        @click="$emit('open')"
      >
        <SvgIcon name="import" class="mb-18px h-48px w-48px" />
        <div name="drop-title" class="text-20px font-600">
          {{ loading ? '正在下载并解析日志包…' : '拖拽 ZIP 到这里' }}
        </div>
        <div name="drop-description" class="mt-8px text-[#64748b]">
          或点击选择本地 ZIP 文件
        </div>
        <div name="privacy-tip" class="mt-24px text-12px text-[#94a3b8]">
          文件只在当前浏览器中解析，不会上传；远程日志会在本机缓存最多 7 天
        </div>
      </div>
    </NSpin>
  </div>
</template>
