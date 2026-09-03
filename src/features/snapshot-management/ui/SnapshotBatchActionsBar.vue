<script setup lang="tsx">
import type { TaskLike } from '@/shared/lib/task';

defineProps<{
  checkedCount: number;
  batchDelete: TaskLike;
  batchDownloadImage?: TaskLike;
  batchDownloadZip?: TaskLike;
  batchShareImageUrl?: TaskLike;
  batchShareZipUrl?: TaskLike;
}>();
</script>
<template>
  <div v-if="checkedCount" flex items-center gap-12px>
    <NPopover v-if="batchDownloadZip || batchDownloadImage">
      <template #trigger>
        <NButton> 批量下载 </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="batchDownloadZip"
          :loading="batchDownloadZip.loading"
          @click="batchDownloadZip.invoke"
        >
          批量下载-快照
        </NButton>
        <NButton
          v-if="batchDownloadImage"
          :loading="batchDownloadImage.loading"
          @click="batchDownloadImage.invoke"
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
          :loading="batchShareZipUrl.loading"
          @click="batchShareZipUrl.invoke"
        >
          批量生成链接-快照
        </NButton>
        <NButton
          v-if="batchShareImageUrl"
          :loading="batchShareImageUrl.loading"
          @click="batchShareImageUrl.invoke"
        >
          批量生成链接-图片
        </NButton>
      </NSpace>
    </NPopover>
    <NButton
      :loading="batchDelete.loading"
      :theme-overrides="{ color: '#D03050', textColor: 'white' }"
      @click="batchDelete.invoke"
    >
      批量删除
    </NButton>
    <span whitespace-nowrap>{{ `已选中 ${checkedCount} 项快照` }}</span>
  </div>
</template>
