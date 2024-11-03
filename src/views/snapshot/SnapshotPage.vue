<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import TrackDlg from '@/components/TrackDlg.vue';
import { message, loadingBar } from '@/utils/discrete';
import { delay } from '@/utils/others';
import AttrCard from './AttrCard.vue';
import OverlapCard from './OverlapCard.vue';
import RuleCard from './RuleCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';

const router = useRouter();

const snapshotStore = useSnapshotStore();
const snapshotRefs = storeToRefs(snapshotStore);
const { snapshot, rootNode, track, loading, redirected } = snapshotRefs;

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};
watchEffect(() => {
  if (loading.value) {
    loadingBar.start();
  } else {
    loadingBar.finish();
  }
});
</script>
<template>
  <template v-if="snapshot && rootNode">
    <div h-full flex gap-5px p-5px box-border>
      <ScreenshotCard />
      <WindowCard class="flex-1">
        <ActionCard
          :snapshot="snapshot"
          @delete="onDelete"
          :showPreview="false"
        />
      </WindowCard>
    </div>

    <SearchCard />
    <AttrCard />
    <OverlapCard />
    <RuleCard />
    <TrackDlg :track="track" @updateTrack="track = $event" />
  </template>
  <div v-else-if="!loading && !redirected" flex justify-center pt-80px>
    <div>快照数据缺失</div>
  </div>
</template>
