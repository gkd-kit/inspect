<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import AttrCard from '@/components/AttrCard.vue';
import DraggableCard from '@/components/DraggableCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import SearchCard from '@/components/SearchCard.vue';
import WindowCard from '@/components/WindowCard.vue';
import { delay, toNodeTree } from '@/utils';
import { message } from '@/utils/discrete';
import { storage } from '@/utils/storage';
import type { NaiveNode, SnapshotExt } from '@/utils/types';
import { Snapshot } from '@/utils/types';
import { computed, shallowRef, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const snapshotId = computed(() => String(route.params.snapshotId || ``));

const screenshotUrl = shallowRef(``);
const snapshot = shallowRef<Snapshot>();

watchEffect(async () => {
  const localSnapshot = await storage.getSnapshot(snapshotId.value);
  if (!localSnapshot) {
    message.error(`数据缺失`);
    return;
  }
  const bf = await storage.getScreenshot(snapshotId.value);
  if (!bf) {
    message.create(`数据缺失`);
    return;
  }
  screenshotUrl.value = URL.createObjectURL(new Blob([bf]));
  snapshot.value = localSnapshot;
  root.value = toNodeTree(
    localSnapshot.nodes.map((n) => ({
      ...n,
      attr: {
        ...n.attr,
        index: 0,
        depth: 0,
      },
    })),
  );
  windowX.value = {
    ...localSnapshot,
    node: root.value,
  };
});

const root = shallowRef<NaiveNode>();
const windowX = shallowRef<SnapshotExt>();
const focusNode = shallowRef<NaiveNode>();
// 节点存在层叠渲染的情况
const skipKeys = shallowRef<number[]>([]);

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};
</script>
<template>
  <div class="h-[calc(100%-10px)]" flex gap-5px p-5px>
    <ScreenshotCard
      v-if="screenshotUrl"
      :skip-keys="skipKeys"
      :url="screenshotUrl"
      :node="root"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
    />
    <WindowCard
      v-if="windowX"
      :window-x="windowX"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
      :skip-keys="skipKeys"
      @update:skip-keys="skipKeys = $event"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :show-preview="false"
      />
    </WindowCard>
    <AttrCard v-if="focusNode" :focus-node="focusNode" class="fixed" />
    <SearchCard
      v-if="root"
      :root="root"
      @update:focus-node="focusNode = $event"
    />
  </div>
</template>
