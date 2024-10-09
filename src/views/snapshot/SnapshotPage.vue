<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import { loadingBar, message } from '@/utils/discrete';
import {
  detectSnapshot,
  exportSnapshotAsImportId,
  exportSnapshotAsJpgUrl,
} from '@/utils/export';
import { gmOk } from '@/utils/gm';
import { getAppInfo, listToTree } from '@/utils/node';
import { delay } from '@/utils/others';
import type { GkdSelector } from '@/utils/selector';
import {
  importStorage,
  screenshotStorage,
  settingsStorage,
  snapshotStorage,
} from '@/utils/storage';
import type { RawNode, Snapshot } from '@/utils/types';
import AttrCard from './AttrCard.vue';
import MultiFocusCard from './MultiFocusCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';
import RuleCard from './RuleCard.vue';

const AsyncTrackGraph = (() => {
  const loader = () => import('@/components/TrackGraph.vue');
  setTimeout(loader, 1000);
  return defineAsyncComponent(loader);
})();

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

onMounted(async () => {
  if (!Number.isSafeInteger(+snapshotId.value)) {
    message.error('非法快照ID');
    return;
  }
  const localSnapshot = await snapshotStorage.getItem(snapshotId.value);
  if (!localSnapshot) {
    loadingBar.start();
    try {
      const importId: number | null =
        importStorage[snapshotId.value] ||
        (await fetch(
          'https://detect.gkd.li/api/getImportId?id=' + snapshotId.value,
        ).then((r) => r.json()));
      if (importId && Number.isSafeInteger(importId)) {
        router.replace({
          path: '/i/' + importId,
          query: route.query,
        });
        return;
      }
    } finally {
      loadingBar.finish();
    }
    message.error(`快照数据缺失`);
    return;
  }
  setTimeout(() => {
    const importId = importStorage[localSnapshot.id];
    if (importId) {
      detectSnapshot(importId);
    }
  }, 1000);
  if (gmOk() && settingsStorage.autoUploadImport) {
    // 静默生成 jpg/zip
    setTimeout(async () => {
      exportSnapshotAsJpgUrl(localSnapshot);
      if (!importStorage[localSnapshot.id]) {
        exportSnapshotAsImportId(
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
  screenshotUrl.value = URL.createObjectURL(
    new Blob([bf], {
      type: 'image/png',
    }),
  );
  snapshot.value = localSnapshot;
  rootNode.value = listToTree(localSnapshot.nodes);
  title.value = '快照-' + getAppInfo(localSnapshot).name || localSnapshot.appId;
  if (!focusNode.value) {
    focusNode.value = rootNode.value;
  }
});

const rootNode = shallowRef<RawNode>();
const focusNode = shallowRef<RawNode>();
const focusCount = shallowRef(0);

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};

const track = shallowRef<{
  selector: GkdSelector;
  nodes: RawNode[];
}>();
const trackVisible = shallowRef(false);
watchEffect(() => {
  if (track.value) {
    trackVisible.value = true;
  }
});
const multiFocus = shallowRef<{
  nodes: RawNode[];
  position: { x: number; y: number };
}>();
watch(
  () => focusNode.value,
  (newNode) => {
    const nodes = multiFocus.value?.nodes;
    if (!nodes) return;
    if (!newNode || !nodes.includes(newNode)) {
      multiFocus.value = undefined;
    }
  },
);
</script>
<template>
  <div h-full flex gap-5px p-5px box-border>
    <ScreenshotCard
      v-if="screenshotUrl && snapshot"
      :url="screenshotUrl"
      :snapshot="snapshot"
      :rootNode="rootNode"
      :focusNode="focusNode"
      @updateFocusNode="
        focusNode = $event;
        focusCount++;
      "
      @updateFocusNodes="multiFocus = $event"
    />
    <WindowCard
      v-if="snapshot && rootNode"
      :rootNode="rootNode"
      :snapshot="snapshot"
      :focusNode="focusNode"
      @updateFocusNode="focusNode = $event"
      :focusCount="focusCount"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :showPreview="false"
      />
    </WindowCard>
  </div>

  <AttrCard v-if="focusNode" :focusNode="focusNode" />
  <SearchCard
    v-if="rootNode && snapshot"
    :snapshot="snapshot"
    :rootNode="rootNode"
    :focusNode="focusNode"
    @updateFocusNode="
      focusNode = $event;
      focusCount++;
    "
    @updateTrack="track = $event"
  />
  <MultiFocusCard
    :focusNode="focusNode"
    :focusNodes="multiFocus"
    @updateFocusNode="
      focusNode = $event;
      focusCount++;
    "
    @close="multiFocus = undefined"
  />
  <RuleCard
    v-if="rootNode"
    :root="rootNode"
    :focusNode="focusNode"
    @updateFocusNode="
      focusNode = $event;
      focusCount++;
    "
  />
  <NModal
    v-model:show="trackVisible"
    preset="dialog"
    title="选择器路径视图"
    class="min-w-[calc(var(--gkd-width)*0.4)]"
    @afterLeave="track = undefined"
  >
    <template #icon>
      <NIcon>
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M5 21V8.825Q4.125 8.5 3.563 7.738T3 6q0-1.25.875-2.125T6 3q1.25 0 2.125.875T9 6q0 .975-.562 1.738T7 8.825V19h4V3h8v12.175q.875.325 1.438 1.088T21 18q0 1.25-.875 2.125T18 21q-1.25 0-2.125-.875T15 18q0-.975.563-1.75T17 15.175V5h-4v16zM6 7q.425 0 .713-.288T7 6q0-.425-.288-.712T6 5q-.425 0-.712.288T5 6q0 .425.288.713T6 7m12 12q.425 0 .713-.288T19 18q0-.425-.288-.712T18 17q-.425 0-.712.288T17 18q0 .425.288.713T18 19m0-1"
          />
        </svg>
      </NIcon>
    </template>
    <div v-if="track" class="gkd_code py-2px px-4px rounded-2px bg-[#eee]">
      {{ track.selector.toString() }}
    </div>
    <AsyncTrackGraph v-if="track" :track="track" />
    <div opacity-75 text-12px>*为简化视图已隐藏部分节点</div>
  </NModal>
</template>
