<script setup lang="tsx">
import { showTextDLg } from '@/utils/dialog';
import {
  exportSnapshotAsPng,
  exportSnapshotAsPngUrl,
  exportSnapshotAsZip,
  exportSnapshotAsZipUrl,
} from '@/utils/export';
import { delay } from '@/utils/others';
import { snapshotStorage } from '@/utils/storage';
import { useTask } from '@/utils/task';
import { Snapshot } from '@/utils/types';
import { githubUrlToSelfUrl } from '@/utils/url';
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
    onDelete: () => () => {},
  },
);

const router = useRouter();

const exportPng = useTask(async () =>
  exportSnapshotAsPng((await snapshotStorage.getItem(props.snapshot.id))!),
);
const exportZip = useTask(async () =>
  exportSnapshotAsZip((await snapshotStorage.getItem(props.snapshot.id))!),
);

const previewUrl = computed(() => {
  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: props.snapshot.id },
  }).href;
});

const exportPngUrl = useTask(async () => {
  const pngUrl = await exportSnapshotAsPngUrl(
    (await snapshotStorage.getItem(props.snapshot.id))!,
  );
  showTextDLg({
    title: `分享链接`,
    content: githubUrlToSelfUrl(pngUrl),
  });
});

const exportZipUrl = useTask(async () => {
  const zipUrl = await exportSnapshotAsZipUrl(
    (await snapshotStorage.getItem(props.snapshot.id))!,
  );
  showTextDLg({
    title: `分享链接`,
    content: githubUrlToSelfUrl(zipUrl),
  });
});

const deleteSnapshot = async () => {
  await snapshotStorage.removeItem(props.snapshot.id);
  await delay(500);
  props.onDelete();
};
</script>
<template>
  <NSpace>
    <a v-if="showPreview" target="_blank" :href="previewUrl">
      <NButton size="small"> {{ $t(`preview`) }} </NButton>
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
