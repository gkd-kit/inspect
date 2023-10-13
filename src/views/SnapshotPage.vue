<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import AttrCard from '@/components/AttrCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import SearchCard from '@/components/SearchCard.vue';
import WindowCard from '@/components/WindowCard.vue';
import { listToTree } from '@/utils/node';
import { message } from '@/utils/discrete';
import { delay } from '@/utils/others';
import {
  snapshotStorage,
  screenshotStorage,
  githubZipStorage,
} from '@/utils/storage';
import type { RawNode, Snapshot } from '@/utils/types';
import { computed, shallowRef, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTitle } from '@vueuse/core';
import { gmOk } from '@/utils/gm';
import { exportSnapshotAsJpgUrl, exportSnapshotAsZipUrl } from '@/utils/export';

const route = useRoute();
const router = useRouter();
const title = useTitle();

const snapshotId = computed(() => String(route.params.snapshotId || ``));
const showSize = computed(() => {
  const n = Number(route.query.showSize || ``);
  if (!Number.isSafeInteger(n) || n <= 0) {
    return 2000;
  }
  return n;
});

const screenshotUrl = shallowRef(``);
const snapshot = shallowRef<Snapshot>();

watchEffect(async () => {
  const localSnapshot = await snapshotStorage.getItem(snapshotId.value);
  if (!localSnapshot) {
    message.error(`快照数据缺失`);
    return;
  }
  if (gmOk()) {
    // 静默生成 jpg/zip
    setTimeout(async () => {
      exportSnapshotAsJpgUrl(localSnapshot);
      if (!githubZipStorage[localSnapshot.id]) {
        exportSnapshotAsZipUrl(
          (await snapshotStorage.getItem(snapshotId.value))!,
        );
      }
    }, 1000);
  }
  if (localSnapshot.nodes.length > showSize.value) {
    message.warning(
      `当前展示节点数量为${showSize.value}\n之后的${
        localSnapshot.nodes.length - showSize.value
      }个节点将被丢弃\n使用showSize查询参数可以修改展示数量`,
    );
    localSnapshot.nodes = localSnapshot.nodes.slice(0, showSize.value);
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
      @updateFocusNode="focusNode = $event"
    />
    <WindowCard
      v-if="snapshot && rootNode"
      :rootNode="rootNode"
      :snapshot="snapshot"
      :focusNode="focusNode"
      @updateFocusNode="focusNode = $event"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :showPreview="false"
      />
    </WindowCard>
    <AttrCard v-if="focusNode" :focusNode="focusNode" />
    <SearchCard
      v-if="rootNode"
      :rootNode="rootNode"
      @updateFocusNode="focusNode = $event"
    />
  </div>
</template>
