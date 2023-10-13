<script setup lang="tsx">
import { toValidURL } from '@/utils/check';
import { loadingBar, message } from '@/utils/discrete';
import { importFromNetwork } from '@/utils/import';
import { delay } from '@/utils/others';
import { githubZipStorage } from '@/utils/storage';
import { githubPngStorage } from '@/utils/storage';
import { urlStorage, snapshotStorage } from '@/utils/storage';
import { githubImageUrlReg, githubZipUrlReg } from '@/utils/url';
import { onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const importUrl = String(route.query.url || ``);

const loading = shallowRef(true);
const tip = shallowRef(`加载中...`);

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
      router.replace({
        name: 'snapshot',
        params: { snapshotId },
      });
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
          githubPngStorage[snapshot.id] = importUrl;
        }
        loading.value = false;
        await delay(500);
        router.replace({
          name: 'snapshot',
          params: { snapshotId: snapshot.id },
        });
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
    p-5px
    flex-col
    flex-items-center
  >
    <div v-show="loading" mt-40px>
      {{ tip }}
    </div>
  </div>
</template>
