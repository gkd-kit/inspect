<script setup lang="tsx">
import { delay } from '@/utils';
import { toValidURL } from '@/utils/check';
import { loadingBar, message } from '@/utils/discrete';
import { importFromNetwork } from '@/utils/import';
import { storage } from '@/utils/storage';
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
  const snapshotId = await storage.getImportId(importUrl);
  if (snapshotId) {
    const snapshot = await storage.getSnapshot(snapshotId);
    if (snapshot) {
      router.replace({
        name: 'snapshot',
        params: { snapshotId },
      });
      return;
    } else {
      await storage.deleteImportId(importUrl);
    }
  }
  loadingBar.start();
  try {
    const [result] = (await importFromNetwork(importUrl)) ?? [];

    if (result.status == 'fulfilled') {
      loadingBar.finish();
      const snapshot = result.value;
      if (snapshot) {
        await storage.setImportId(importUrl, snapshot.id);
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
