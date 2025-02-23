<script setup lang="tsx">
import { showTextDLg, waitShareAgree } from '@/utils/dialog';
import { message } from '@/utils/discrete';
import {
  exportSnapshotAsImportId,
  exportSnapshotAsImage,
  exportSnapshotAsImageId,
  exportSnapshotAsZip,
} from '@/utils/export';
import { buildEmptyFn, delay } from '@/utils/others';
import { snapshotStorage } from '@/utils/snapshot';
import { useTask } from '@/utils/task';
import type { Snapshot } from '@/utils/types';
import { getImportUrl, getImagUrl } from '@/utils/url';

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
    onDelete: buildEmptyFn,
  },
);

const router = useRouter();
const { snapshotImportId, snapshotImageId } = useStorageStore();

const exportJpg = useTask(async () => exportSnapshotAsImage(props.snapshot));
const exportZip = useTask(async () => exportSnapshotAsZip(props.snapshot));

const previewUrl = computed(() => {
  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: props.snapshot.id },
  }).href;
});

const exportJpgUrl = useTask(async () => {
  await waitShareAgree();
  const imageId = await exportSnapshotAsImageId(props.snapshot);
  showTextDLg({
    title: `分享链接`,
    content: getImagUrl(imageId),
  });
});

const exportZipUrl = useTask(async () => {
  await waitShareAgree();
  const importId = await exportSnapshotAsImportId(props.snapshot);
  showTextDLg({
    title: `分享链接`,
    content: location.origin + `/i/${importId}`,
  });
});

const deleteSnapshot = async () => {
  await snapshotStorage.removeItem(props.snapshot.id);
  await delay(500);
  props.onDelete();
};

const copy = async (content: string) => {
  return navigator.clipboard
    .writeText(content)
    .then(() => {
      message.success(`复制成功`);
    })
    .catch(() => {
      message.success(`复制失败`);
    });
};
</script>
<template>
  <div flex gap-16px>
    <a v-if="showPreview" flex target="_blank" :href="previewUrl">
      <NButton text title="查看">
        <template #icon>
          <SvgIcon name="code" />
        </template>
      </NButton>
    </a>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton text>
          <template #icon>
            <SvgIcon name="export" />
          </template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton @click="exportZip.invoke" :loading="exportZip.loading">
          下载-快照
        </NButton>
        <NButton @click="exportJpg.invoke" :loading="exportJpg.loading">
          下载-图片
        </NButton>
      </NSpace>
    </NPopover>

    <NPopover v-if="showShare">
      <template #trigger>
        <NButton text>
          <template #icon>
            <SvgIcon name="share" />
          </template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="snapshotImportId[snapshot.id]"
          @click="copy(getImportUrl(snapshotImportId[snapshot.id]))"
        >
          复制链接-快照
        </NButton>
        <NButton
          v-else
          @click="exportZipUrl.invoke"
          :loading="exportZipUrl.loading"
        >
          生成链接-快照
        </NButton>
        <NButton
          v-if="snapshotImageId[snapshot.id]"
          @click="copy(getImagUrl(snapshotImageId[snapshot.id]))"
        >
          复制链接-图片
        </NButton>
        <NButton
          v-else
          @click="exportJpgUrl.invoke"
          :loading="exportJpgUrl.loading"
        >
          生成链接-图片
        </NButton>
      </NSpace>
    </NPopover>

    <NPopconfirm v-if="showDelete" @positive-click="deleteSnapshot">
      是否删除快照?
      <template #trigger>
        <NTooltip>
          <template #trigger>
            <NButton text>
              <template #icon>
                <SvgIcon name="delete" />
              </template>
            </NButton>
          </template>
          删除快照
        </NTooltip>
      </template>
    </NPopconfirm>
  </div>
</template>
