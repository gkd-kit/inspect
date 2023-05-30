<script setup lang="tsx">
import { delay } from '@/utils';
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

const showShareDlg = (href: string) => {
  dialog.success({
    title: `成功生成链接`,
    content: () => {
      return (
        <div>
          <div>{href}</div>
          <div class="h-20px"></div>
          <div>
            {
              new URL(
                router.resolve({
                  name: `import`,
                  query: {
                    url: href,
                  },
                }).href,
                location.origin,
              ).href
            }
          </div>
        </div>
      );
    },
  });
};

const exportPngUrl = useTask(async () => {
  const githubAsset = await exportSnapshotAsPngUrl(props.snapshot);
  showShareDlg(githubAsset.href);
});

const exportZipUrl = useTask(async () => {
  const githubAsset = await exportSnapshotAsZipUrl(props.snapshot);
  showShareDlg(githubAsset.href);
});

const deleteSnapshot = useTask(async () => {
  await storage.deleteSnapshot(props.snapshot.id);
  await delay(1500);
  props.onDelete?.();
});
</script>
<template>
  <NSpace>
    <a target="_blank" :href="previewUrl" v-if="showPreview">
      <NButton>查看</NButton>
    </a>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton> 导出 </NButton>
      </template>
      <NSpace vertical>
        <NButton @click="exportPng.invoke" :loading="exportPng.loading">
          导出-png
        </NButton>
        <NButton @click="exportZip.invoke" :loading="exportZip.loading">
          导出-zip
        </NButton>
      </NSpace>
    </NPopover>

    <NPopover v-if="showShare">
      <template #trigger>
        <NButton> 分享 </NButton>
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

    <NButton
      v-if="showDelete"
      @click="deleteSnapshot.invoke"
      :loading="deleteSnapshot.loading"
    >
      删除
    </NButton>
  </NSpace>
</template>
