<script setup lang="tsx">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useSingleTask } from '@/shared/lib/latest_task';
import { loadingBar, message } from '@/shared/services/feedback';
import { gmOk } from '@/shared/api/gm';
import { importFromNetwork } from '@/features/snapshot-management/import';
import { delay } from '@/shared/lib/async';
import { filterQuery } from '@/shared/lib/route';
import { snapshotStorage } from '@/entities/snapshot/storage';
import { getImportFileUrl, getImportId } from '@/entities/snapshot/urls';
import { isValidUrl } from '@/shared/lib/url';
import { useSnapshotMetadataStore } from '@/entities/snapshot/metadataStore';

const route = useRoute();
const router = useRouter();

const goToSnapshot = async (snapshotId: number) => {
  return router.replace({
    name: 'snapshot',
    params: { snapshotId },
    query: filterQuery(route.query, ['state', 'str', 'gkd']),
  });
};

const url = String(route.query.url || ``);
const importId = getImportId(url);
const { importSnapshotId, actions: snapshotMetadataActions } =
  useSnapshotMetadataStore();

const importTask = useSingleTask(async ({ commit, isCurrent }) => {
  if (!isValidUrl(url)) {
    message.error(`非法URL参数`);
    await delay(1000);
    if (!isCurrent()) return;
    await router.replace({
      path: `/`,
    });
    return;
  }
  if (importId) {
    const snapshotId = importSnapshotId[importId];
    if (snapshotId) {
      const snapshot = await snapshotStorage.getItem(snapshotId);
      if (!isCurrent()) return;
      if (snapshot) {
        await goToSnapshot(snapshotId);
        return;
      }
    }
  }
  loadingBar.start();
  try {
    const [snapshot] =
      (await importFromNetwork(importId ? getImportFileUrl(importId) : url)) ||
      [];
    if (snapshot) {
      loadingBar.finish();
      if (snapshot?.id) {
        commit(() => {
          if (importId) {
            snapshotMetadataActions.setSnapshotId(importId, snapshot.id);
            snapshotMetadataActions.setImportId(snapshot.id, importId);
          }
        });
        await delay(500);
        if (isCurrent()) await goToSnapshot(snapshot.id);
      } else {
        throw new Error(`获取资源失败`);
      }
    } else throw new Error(`获取资源失败`);
  } catch (error) {
    loadingBar.error();
    throw new Error(`加载资源失败`, { cause: error });
  }
});
const loading = importTask.loading;
const tip = computed(() => importTask.error.value?.message || `加载中...`);
onMounted(() => {
  void importTask.run();
});
onBeforeUnmount(importTask.cancel);
</script>
<template>
  <div
    class="w-(--gkd-w) h-(--gkd-h) flex gap-[5px] pt-[40px] flex-col items-center"
  >
    <div v-if="!gmOk()" class="mb-[20px]">
      建议安装并启用
      <a
        href="https://github.com/gkd-kit/network-extension"
        target="_blank"
        rel="noopener noreferrer"
      >
        油猴脚本
      </a>
      获取更快加载速度
    </div>
    <div v-show="loading || importTask.error.value">
      {{ tip }}
    </div>
  </div>
</template>
