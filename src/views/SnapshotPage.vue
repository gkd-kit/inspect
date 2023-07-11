<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import AttrCard from '@/components/AttrCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import SearchCard from '@/components/SearchCard.vue';
import WindowCard from '@/components/WindowCard.vue';
import { listToTree } from '@/utils/node';
import { message } from '@/utils/discrete';
import { delay } from '@/utils/others';
import { snapshotStorage, screenshotStorage } from '@/utils/storage';
import type { RawNode, Snapshot } from '@/utils/types';
import { computed, shallowRef, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTitle } from '@vueuse/core';

const route = useRoute();
const router = useRouter();
const title = useTitle();

const snapshotId = computed(() => String(route.params.snapshotId || ``));

const screenshotUrl = shallowRef(``);
const snapshot = shallowRef<Snapshot>();

watchEffect(async () => {
  const localSnapshot = await snapshotStorage.getItem(snapshotId.value);
  if (!localSnapshot) {
    message.error(`快照数据缺失`);
    return;
  }
  const bf = await screenshotStorage.getItem(snapshotId.value);
  if (!bf) {
    message.create(`截屏数据缺失`);
    return;
  }
  screenshotUrl.value = URL.createObjectURL(new Blob([bf]));
  snapshot.value = localSnapshot;
  rootNode.value = listToTree(localSnapshot.nodes);
  title.value = '快照-' + localSnapshot.appName || localSnapshot.appId;
});

const rootNode = shallowRef<RawNode>();
const focusNode = shallowRef<RawNode>();
// 节点存在层叠渲染的情况,而且 Android 无障碍无法获取 z-index
// const skipKeys = shallowRef<number[]>([]);

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};
</script>
<template>
  <div h-full flex gap-5px p-5px box-border>
    <ScreenshotCard
      v-if="screenshotUrl && snapshot"
      :url="screenshotUrl"
      :snapshot="snapshot"
      :rootNode="rootNode"
      :focusNode="focusNode"
      @update:focusNode="focusNode = $event"
    />
    <WindowCard
      v-if="snapshot && rootNode"
      :rootNode="rootNode"
      :snapshot="snapshot"
      :focusNode="focusNode"
      @update:focusNode="focusNode = $event"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :showPreview="false"
      />
    </WindowCard>
    <AttrCard v-if="focusNode" :focus-node="focusNode" />
    <SearchCard
      v-if="rootNode"
      :rootNode="rootNode"
      @update:focusNode="focusNode = $event"
    />
  </div>
</template>
