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

const route = useRoute();
const router = useRouter();

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
      :root-node="rootNode"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
    />
    <WindowCard
      v-if="snapshot && rootNode"
      :root-node="rootNode"
      :snapshot="snapshot"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :show-preview="false"
      />
    </WindowCard>
    <AttrCard v-if="focusNode" :focus-node="focusNode" />
    <SearchCard
      v-if="rootNode"
      :root-node="rootNode"
      @update:focus-node="focusNode = $event"
    />
  </div>
</template>
