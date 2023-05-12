<script lang="ts" setup>
import AttrCard from '@/components/AttrCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import WindowCard from '@/components/WindowCard.vue';
import { toNodeTree } from '@/utils';
import { message } from '@/utils/discrete';
import storage from '@/utils/storage';
import type { NodeX, WindowX } from '@/utils/types';
import { computed, ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const snapshotId = computed(() => String(route.params.snapshotId));

const screenshotUrl = ref(``);

watchEffect(async () => {
  const bf = await storage.getScreenshot(snapshotId.value);
  screenshotUrl.value =
    (bf && URL.createObjectURL(new Blob([bf]))) ||
    `/api/rpc/screenshot?id=` + snapshotId.value;
});

watchEffect(async () => {
  const windowx = await storage.getWindow(snapshotId.value);
  if (!windowx) {
    message.error(`数据缺失`);
    return;
  }
  rootNode.value = toNodeTree(
    windowx.nodes.map((n) => ({
      ...n,
      attr: {
        ...n.attr,
        index: 0,
        depth: 0,
      },
    })),
  );
  windowX.value = {
    ...windowx,
    node: rootNode.value,
  };
});

const rootNode = ref<NodeX>();
const windowX = ref<WindowX>();
const focusNode = ref<NodeX>();
// 节点存在层叠渲染的情况
const skipKeys = ref<number[]>([]);
</script>
<template>
  <div class="h-[calc(100%-10px)]" flex gap-5px p-5px>
    <ScreenshotCard
      v-if="screenshotUrl"
      :skip-keys="skipKeys"
      :url="screenshotUrl"
      :node="rootNode"
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
    />
    <AttrCard
      v-if="focusNode"
      :attr="focusNode.value.attr"
      class="fixed top-90px right-30px max-w-600px"
    />
  </div>
</template>
