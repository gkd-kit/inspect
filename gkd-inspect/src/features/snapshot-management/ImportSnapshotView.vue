<script setup lang="tsx">
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

const loading = shallowRef(true);
const tip = shallowRef(`加载中...`);

const goToSnapshot = async (snapshotId: number) => {
  router.replace({
    name: 'snapshot',
    params: { snapshotId },
    query: filterQuery(route.query, ['state', 'str', 'gkd']),
  });
};

const url = String(route.query.url || ``);
const importId = getImportId(url);
const { importSnapshotId, actions: snapshotMetadataActions } =
  useSnapshotMetadataStore();

onMounted(async () => {
  if (!isValidUrl(url)) {
    message.error(`非法URL参数`);
    await delay(1000);
    router.replace({
      path: `/`,
    });
    return;
  }
  if (importId) {
    const snapshotId = importSnapshotId[importId];
    if (snapshotId) {
      const snapshot = await snapshotStorage.getItem(snapshotId);
      if (snapshot) {
        goToSnapshot(snapshotId);
        return;
      } else {
        snapshotMetadataActions.setSnapshotId(importId);
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
        if (importId) {
          snapshotMetadataActions.setSnapshotId(importId, snapshot.id);
          snapshotMetadataActions.setImportId(snapshot.id, importId);
        }
        loading.value = false;
        await delay(500);
        goToSnapshot(snapshot.id);
      } else {
        tip.value = `获取资源失败`;
      }
    }
  } catch {
    loadingBar.error();
    tip.value = `加载资源失败`;
  }
});
</script>
<template>
  <div page-size flex gap-5px pt-40px flex-col flex-items-center>
    <div v-if="!gmOk()" mb-20px>
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
    <div v-show="loading">
      {{ tip }}
    </div>
  </div>
</template>
