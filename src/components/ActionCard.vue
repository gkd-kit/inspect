<script setup lang="tsx">
import { showTextDLg } from '@/utils/dialog';
import { message } from '@/utils/discrete';
import {
  exportSnapshotAsJpg,
  exportSnapshotAsJpgUrl,
  exportSnapshotAsZip,
  exportSnapshotAsZipUrl,
} from '@/utils/export';
import { delay } from '@/utils/others';
import {
  githubJpgStorage,
  githubZipStorage,
  snapshotStorage,
} from '@/utils/storage';
import { useTask } from '@/utils/task';
import { Snapshot } from '@/utils/types';
import { githubUrlToSelfUrl } from '@/utils/url';
import { NButton, NIcon, NPopover, NSpace } from 'naive-ui';
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

const exportJpg = useTask(async () =>
  exportSnapshotAsJpg((await snapshotStorage.getItem(props.snapshot.id))!),
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

const exportJpgUrl = useTask(async () => {
  const pngUrl = await exportSnapshotAsJpgUrl(
    (await snapshotStorage.getItem(props.snapshot.id))!,
  );
  showTextDLg({
    title: `分享链接`,
    content: githubUrlToSelfUrl(router, pngUrl),
  });
});

const exportZipUrl = useTask(async () => {
  const zipUrl = await exportSnapshotAsZipUrl(
    (await snapshotStorage.getItem(props.snapshot.id))!,
  );
  showTextDLg({
    title: `分享链接`,
    content: githubUrlToSelfUrl(router, zipUrl),
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
  <NSpace>
    <a v-if="showPreview" target="_blank" :href="previewUrl">
      <NButton size="small">
        <template #icon>
          <NIcon>
            <svg
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              width="200"
              height="200"
            >
              <path
                d="M549.973333 128 633.6 145.066667 474.026667 896 390.4 878.933333 549.973333 128M835.84 512 682.666667 358.826667 682.666667 238.08 956.586667 512 682.666667 785.493333 682.666667 664.746667 835.84 512M67.413333 512 341.333333 238.08 341.333333 358.826667 188.16 512 341.333333 664.746667 341.333333 785.493333 67.413333 512Z"
              ></path>
            </svg>
          </NIcon>
        </template>
      </NButton>
    </a>

    <NPopover v-if="showExport">
      <template #trigger>
        <NButton size="small">
          <template #icon>
            <NIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 24 24"
              >
                <g
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
                  <path d="M7 11l5 5l5-5"></path>
                  <path d="M12 4v12"></path>
                </g>
              </svg>
            </NIcon>
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
        <NButton size="small">
          <template #icon>
            <NIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 24 24"
              >
                <path
                  d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81c1.66 0 3-1.34 3-3s-1.34-3-3-3s-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65c0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
                  fill="currentColor"
                ></path>
              </svg>
            </NIcon>
          </template>
        </NButton>
      </template>
      <NSpace vertical>
        <NButton
          v-if="githubZipStorage[snapshot.id]"
          @click="
            copy(githubUrlToSelfUrl($router, githubZipStorage[snapshot.id]))
          "
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
          v-if="githubJpgStorage[snapshot.id]"
          @click="
            copy(githubUrlToSelfUrl($router, githubJpgStorage[snapshot.id]))
          "
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

    <NButton v-if="showDelete" size="small" @click="deleteSnapshot">
      <template #icon>
        <NIcon>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 24 24"
          >
            <g fill="none">
              <path
                d="M12 1.75a3.25 3.25 0 0 1 3.245 3.066L15.25 5h5.25a.75.75 0 0 1 .102 1.493L20.5 6.5h-.796l-1.28 13.02a2.75 2.75 0 0 1-2.561 2.474l-.176.006H8.313a2.75 2.75 0 0 1-2.714-2.307l-.023-.174L4.295 6.5H3.5a.75.75 0 0 1-.743-.648L2.75 5.75a.75.75 0 0 1 .648-.743L3.5 5h5.25A3.25 3.25 0 0 1 12 1.75zm6.197 4.75H5.802l1.267 12.872a1.25 1.25 0 0 0 1.117 1.122l.127.006h7.374c.6 0 1.109-.425 1.225-1.002l.02-.126L18.196 6.5zM13.75 9.25a.75.75 0 0 1 .743.648L14.5 10v7a.75.75 0 0 1-1.493.102L13 17v-7a.75.75 0 0 1 .75-.75zm-3.5 0a.75.75 0 0 1 .743.648L11 10v7a.75.75 0 0 1-1.493.102L9.5 17v-7a.75.75 0 0 1 .75-.75zm1.75-6a1.75 1.75 0 0 0-1.744 1.606L10.25 5h3.5A1.75 1.75 0 0 0 12 3.25z"
                fill="currentColor"
              ></path>
            </g></svg
        ></NIcon>
      </template>
    </NButton>
  </NSpace>
</template>
