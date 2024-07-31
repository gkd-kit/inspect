<script setup lang="tsx">
import { loadingBar, message } from '@/utils/discrete';
import { detectSnapshot } from '@/utils/export';
import { gmOk } from '@/utils/gm';
import { importFromNetwork } from '@/utils/import';
import { delay, filterQuery } from '@/utils/others';
import { importStorage, snapshotStorage, urlStorage } from '@/utils/storage';
import { getImportFileUrl, getImportId, isValidUrl } from '@/utils/url';

const route = useRoute();
const router = useRouter();

const loading = shallowRef(true);
const tip = shallowRef(`加载中...`);

const goToSnapshot = async (snapshotId: number) => {
  router.replace({
    name: 'snapshot',
    params: { snapshotId },
    query: filterQuery(route.query, ['str', 'gkd']),
  });
};

const url = String(route.query.url || ``);
const importId = getImportId(url);

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
    const snapshotId = urlStorage[importId];
    if (snapshotId) {
      const snapshot = await snapshotStorage.getItem(snapshotId);
      if (snapshot) {
        goToSnapshot(snapshotId);
        return;
      } else {
        delete urlStorage[importId];
      }
    }
  }
  loadingBar.start();
  try {
    const [result] =
      (await importFromNetwork(importId ? getImportFileUrl(importId) : url)) ??
      [];

    if (result.status == 'fulfilled') {
      loadingBar.finish();
      const snapshot = result.value;
      if (snapshot?.id) {
        if (importId) {
          detectSnapshot(importId);
          urlStorage[importId] = snapshot.id;
          importStorage[snapshot.id] = importId;
        }
        loading.value = false;
        await delay(500);
        goToSnapshot(snapshot.id);
      } else {
        tip.value = `获取资源失败`;
      }
    } else {
      throw result.reason;
    }
  } catch {
    loadingBar.error();
    tip.value = `加载资源失败`;
  }
});
</script>
<template>
  <div
    class="h-[calc(100%-10px)]"
    flex
    gap-5px
    pt-40px
    flex-col
    flex-items-center
  >
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
