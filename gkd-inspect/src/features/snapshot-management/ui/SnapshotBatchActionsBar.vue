<script setup lang="tsx">
import { NButton, NPopover, NSpace } from 'naive-ui';

import type { useSingleTask } from '@/shared/lib/latest_task';
type BatchTask = Pick<
  ReturnType<typeof useSingleTask<[], void>>,
  'loading' | 'run'
>;

defineProps<{
  checkedCount: number;
  batchDelete: BatchTask;
  batchDownloadImage?: BatchTask;
  batchDownloadZip?: BatchTask;
  batchShareImageUrl?: BatchTask;
  batchShareZipUrl?: BatchTask;
}>();
</script>
<template>
  <div v-if="checkedCount" class="flex items-center gap-[12px]">
    <NPopover v-if="batchDownloadZip || batchDownloadImage">
      <template #trigger>
        <NButton> 批量下载 </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="batchDownloadZip"
          :loading="batchDownloadZip.loading.value"
          @click="batchDownloadZip.run"
        >
          批量下载-快照
        </NButton>
        <NButton
          v-if="batchDownloadImage"
          :loading="batchDownloadImage.loading.value"
          @click="batchDownloadImage.run"
        >
          批量下载-图片
        </NButton>
      </NSpace>
    </NPopover>
    <NPopover v-if="batchShareZipUrl || batchShareImageUrl">
      <template #trigger>
        <NButton> 批量分享 </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="batchShareZipUrl"
          :loading="batchShareZipUrl.loading.value"
          @click="batchShareZipUrl.run"
        >
          批量生成链接-快照
        </NButton>
        <NButton
          v-if="batchShareImageUrl"
          :loading="batchShareImageUrl.loading.value"
          @click="batchShareImageUrl.run"
        >
          批量生成链接-图片
        </NButton>
      </NSpace>
    </NPopover>
    <NButton
      :loading="batchDelete.loading.value"
      :theme-overrides="{ color: '#D03050', textColor: 'white' }"
      @click="batchDelete.run"
    >
      批量删除
    </NButton>
    <span class="whitespace-nowrap">{{ `已选中 ${checkedCount} 项快照` }}</span>
  </div>
</template>
