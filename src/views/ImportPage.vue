<script setup lang="tsx">
import { toValidURL } from '@/utils/check';
import { loadingBar, message } from '@/utils/discrete';
import { gmOk } from '@/utils/gm';
import { importFromNetwork } from '@/utils/import';
import { delay, filterQuery } from '@/utils/others';
import {
  githubJpgStorage,
  githubZipStorage,
  snapshotStorage,
  urlStorage,
} from '@/utils/storage';
import { githubImageUrlReg, githubZipUrlReg } from '@/utils/url';
import { onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const importUrl = String(route.query.url || ``);

const loading = shallowRef(true);
const tip = shallowRef(`加载中...`);

const goToSnapshot = async (snapshotId: number) => {
  router.replace({
    name: 'snapshot',
    params: { snapshotId },
    query: filterQuery(route.query, ['str', 'gkd']),
  });
};

onMounted(async () => {
  if (!toValidURL(importUrl)) {
    message.error(`非法URL参数`);
    await delay(1000);
    router.replace({
      path: `/`,
    });
    return;
  }
  await delay(1000);
  const snapshotId = urlStorage[importUrl];
  if (snapshotId) {
    const snapshot = await snapshotStorage.getItem(snapshotId);
    if (snapshot) {
      goToSnapshot(snapshotId);
      return;
    } else {
      delete urlStorage[importUrl];
    }
  }
  loadingBar.start();
  try {
    const [result] = (await importFromNetwork(importUrl)) ?? [];

    if (result.status == 'fulfilled') {
      loadingBar.finish();
      const snapshot = result.value;
      if (snapshot?.id) {
        urlStorage[importUrl] = snapshot.id;
        if (importUrl.match(githubZipUrlReg)) {
          githubZipStorage[snapshot.id] = importUrl;
        } else if (importUrl.match(githubImageUrlReg)) {
          githubJpgStorage[snapshot.id] = importUrl;
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
