<script setup lang="tsx">
import { showTextDLg, waitShareAgree } from '@/domain/snapshot/dialog';
import { message } from '@/utils/discrete';
import {
  exportSnapshotAsImportId,
  exportSnapshotAsImage,
  exportSnapshotAsImageId,
  exportSnapshotAsZip,
} from '@/domain/snapshot/export';
import {
  buildEmptyFn,
  delay,
  withTimeout,
  DELETE_TIMEOUT,
} from '@/utils/others';
import { snapshotStorage } from '@/domain/snapshot/storage';
import { useTask } from '@/utils/task';
import { getImportUrl, getImagUrl } from '@/utils/url';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    onDelete?: () => void;
    onBeforeDelete?: (snapshot: Snapshot) => Promise<unknown>;
    onPreview?: () => void;
    previewLoading?: boolean;
    showPreview?: boolean;
    showExport?: boolean;
    showDelete?: boolean;
    showShare?: boolean;
    deleteConfirmText?: string;
  }>(),
  {
    showPreview: true,
    showExport: true,
    showDelete: true,
    showShare: true,
    onDelete: buildEmptyFn,
    onBeforeDelete: undefined,
    onPreview: undefined,
    previewLoading: false,
    deleteConfirmText: '是否删除快照?',
  },
);

const router = useRouter();
const { snapshotImportId, snapshotImageId } = useStorageStore();

// 1. 基础下载任务
const exportJpg = useTask(async () => exportSnapshotAsImage(props.snapshot));
const exportZip = useTask(async () => exportSnapshotAsZip(props.snapshot));

// 2. 获取已缓存的导入/图片 URL（若无则返回空字符串）
const snapshotImportUrl = computed(() => {
  const id = snapshotImportId[props.snapshot.id];
  return id ? getImportUrl(id) : '';
});

const snapshotImageUrl = computed(() => {
  const id = snapshotImageId[props.snapshot.id];
  return id ? getImagUrl(id) : '';
});

// 3. 预览跳转 URL（统一复用 getImportUrl 逻辑）
const previewUrl = computed(() => {
  const id = snapshotImportId[props.snapshot.id];
  if (id) return getImportUrl(id); // 复用统一的 URL 生成工具

  return router.resolve({
    name: 'snapshot',
    params: { snapshotId: props.snapshot.id },
  }).href;
});

// 4. 远程生成并展示链接
const exportJpgUrl = useTask(async () => {
  await waitShareAgree();
  const imageId = await exportSnapshotAsImageId(props.snapshot);
  showTextDLg({ title: `分享链接`, content: getImagUrl(imageId) });
});

const exportZipUrl = useTask(async () => {
  await waitShareAgree();
  const importId = await exportSnapshotAsImportId(props.snapshot);
  showTextDLg({ title: `分享链接`, content: getImportUrl(importId) }); // 修复了原本手写拼接路径的重复逻辑
});

// 5. 删除逻辑
const deleteSnapshot = useTask(async () => {
  // 远程
  if (props.onBeforeDelete) {
    try {
      await props.onBeforeDelete!(props.snapshot);
    } catch {
      // src\utils\api.ts已经做出提示
      return;
    }
  }
  // 本地
  try {
    await withTimeout(
      () => snapshotStorage.removeItem(props.snapshot.id),
      DELETE_TIMEOUT,
      `本地删除超时`,
    );
  } catch (e: any) {
    message.error(`本地删除失败: ${e?.message}`);
    return;
  }
  await delay(500);
  props.onDelete();
});

// 6. 复制链接逻辑
const copy = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    message.success(`复制成功`);
  } catch {
    message.error(`复制失败`); // 修复错误的图标显示
  }
};
</script>

<template>
  <div flex gap-16px items-center>
    <template v-if="showPreview">
      <a v-if="!onPreview" flex target="_blank" :href="previewUrl">
        <NButton text title="查看">
          <template #icon><SvgIcon name="code" /></template>
        </NButton>
      </a>
      <NButton
        v-else
        text
        title="查看"
        :loading="previewLoading"
        @click="onPreview"
      >
        <template #icon><SvgIcon name="code" /></template>
      </NButton>
    </template>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton text>
          <template #icon><SvgIcon name="export" color="#2080F0" /></template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton :loading="exportZip.loading" @click="exportZip.invoke"
          >下载-快照</NButton
        >
        <NButton :loading="exportJpg.loading" @click="exportJpg.invoke"
          >下载-图片</NButton
        >
      </NSpace>
    </NPopover>

    <NPopover v-if="showShare">
      <template #trigger>
        <NButton text>
          <template #icon><SvgIcon name="share" color="#8A2BE2" /></template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton v-if="snapshotImportUrl" @click="copy(snapshotImportUrl)"
          >复制链接-快照</NButton
        >
        <NButton
          v-else
          :loading="exportZipUrl.loading"
          @click="exportZipUrl.invoke"
          >生成链接-快照</NButton
        >

        <NButton v-if="snapshotImageUrl" @click="copy(snapshotImageUrl)"
          >复制链接-图片</NButton
        >
        <NButton
          v-else
          :loading="exportJpgUrl.loading"
          @click="exportJpgUrl.invoke"
          >生成链接-图片</NButton
        >
      </NSpace>
    </NPopover>

    <NPopconfirm
      v-if="showDelete"
      :positive-button-props="{
        type: 'error',
        loading: deleteSnapshot.loading,
      }"
      @positiveClick="deleteSnapshot.invoke"
    >
      <template #icon><SvgIcon name="warn" color="red" /></template>
      <span style="color: #d03050; white-space: pre-line">{{
        deleteConfirmText
      }}</span>
      <template #trigger>
        <NTooltip
          :theme-overrides="{
            color: '#D03050', // 气泡背景色
            textColor: 'white', // 文字色
          }"
        >
          <template #trigger>
            <NButton text>
              <template #icon
                ><SvgIcon name="delete" color="#D03050"
              /></template>
            </NButton>
          </template>
          删除快照
        </NTooltip>
      </template>
    </NPopconfirm>
  </div>
</template>
