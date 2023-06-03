<script setup lang="tsx">
import { delay } from '@/utils/others';
import { dialog } from '@/utils/discrete';
import {
  exportSnapshotAsPng,
  exportSnapshotAsPngUrl,
  exportSnapshotAsZip,
  exportSnapshotAsZipUrl,
} from '@/utils/export';
import { storage } from '@/utils/storage';
import { useTask } from '@/utils/task';
import { Snapshot } from '@/utils/types';
import { NButton, NPopover, NSpace } from 'naive-ui';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { showTextDLg } from '@/utils/dialog';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    onDelete?: () => void;
    showPreview?: boolean;
    showExport?: boolean;
    showDelete?: boolean;
    showShare?: boolean;
  }>(),
  {
    showPreview: true,
    showExport: true,
    showDelete: true,
    showShare: true,
  },
);

const router = useRouter();

const exportPng = useTask(async () => exportSnapshotAsPng(props.snapshot));
const exportZip = useTask(async () => exportSnapshotAsZip(props.snapshot));

const previewUrl = computed(() => {
  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: props.snapshot.id },
  }).href;
});

const exportPngUrl = useTask(async () => {
  const githubAsset = await exportSnapshotAsPngUrl(props.snapshot);
  showTextDLg({
    title: `分享链接`,
    content: githubAsset.href + '\n',
  });
});

const exportZipUrl = useTask(async () => {
  const githubAsset = await exportSnapshotAsZipUrl(props.snapshot);
  showTextDLg({
    title: `分享链接`,
    content: githubAsset.href + '\n',
  });
});

const deleteSnapshot = async () => {
  await storage.deleteSnapshot(props.snapshot.id);
  await delay(500);
  props.onDelete?.();
};
</script>
<template>
  <NSpace>
    <a v-if="showPreview" target="_blank" :href="previewUrl">
      <NButton size="small">查看</NButton>
    </a>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton size="small"> 下载 </NButton>
      </template>
      <NSpace vertical>
        <NButton @click="exportPng.invoke" :loading="exportPng.loading">
          下载-png
        </NButton>
        <NButton @click="exportZip.invoke" :loading="exportZip.loading">
          下载-zip
        </NButton>
      </NSpace>
    </NPopover>

    <NPopover v-if="showShare">
      <template #trigger>
        <NButton size="small"> 分享 </NButton>
      </template>
      <NSpace vertical>
        <NButton @click="exportPngUrl.invoke" :loading="exportPngUrl.loading">
          生成链接-png
        </NButton>
        <NButton @click="exportZipUrl.invoke" :loading="exportZipUrl.loading">
          生成链接-zip
        </NButton>
      </NSpace>
    </NPopover>

    <NButton v-if="showDelete" size="small" @click="deleteSnapshot">
      删除
    </NButton>
  </NSpace>
</template>
