<script lang="ts" setup>
import TrackModal from '@/components/TrackModal.vue';
import { loadingBar, message } from '@/utils/discrete';
import AttrCard from './AttrCard.vue';
import OverlapCard from './OverlapCard.vue';
import RuleCard from './RuleCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';

const snapshotStore = useSnapshotStore();
const snapshotRefs = storeToRefs(snapshotStore);
const { snapshot, rootNode, loading, redirected, trackData, trackShow } =
  snapshotRefs;

watchEffect(() => {
  if (loading.value) {
    loadingBar.start();
  } else {
    loadingBar.finish();
  }
});

const searchShow = useStorage('searchShow', true, sessionStorage);
const ruleShow = useStorage('ruleShow', false, sessionStorage);
const attrShow = useStorage('attrShow', true, sessionStorage);

const clickSettings = () => {
  message.info('暂未实现');
};
</script>
<template>
  <template v-if="snapshot && rootNode">
    <div h-full flex gap-5px>
      <div
        w-40px
        py-12px
        flex
        flex-col
        items-center
        gap-16px
        class="[--svg-h:24px]"
      >
        <NTooltip placement="right">
          <template #trigger>
            <NButton text>
              <RouterLink to="/">
                <SvgIcon name="home" />
              </RouterLink>
            </NButton>
          </template>
          回到首页
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton @click="clickSettings" text>
              <SvgIcon name="settings" />
            </NButton>
          </template>
          设置
        </NTooltip>
        <div></div>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="searchShow = !searchShow">
              <SvgIcon name="search-list" />
            </NButton>
          </template>
          搜索面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton @click="attrShow = !attrShow" text>
              <SvgIcon name="prop" />
            </NButton>
          </template>
          属性面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton @click="ruleShow = !ruleShow" text>
              <SvgIcon name="test" />
            </NButton>
          </template>
          测试规则
        </NTooltip>
        <div></div>
        <NTooltip placement="right">
          <template #trigger>
            <a
              flex
              justify-center
              href="https://github.com/orgs/gkd-kit/discussions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <SvgIcon name="discussion" />
              </NButton>
            </a>
          </template>
          讨论交流
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <a
              flex
              justify-center
              href="https://gkd.li/guide/snapshot#share-note"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <SvgIcon name="warn" />
              </NButton>
            </a>
          </template>
          分享须知
        </NTooltip>
      </div>
      <ScreenshotCard />
      <WindowCard class="flex-1" />
    </div>

    <SearchCard :show="searchShow" @updateShow="searchShow = $event" />
    <RuleCard :show="ruleShow" @updateShow="ruleShow = $event" />
    <AttrCard :show="attrShow" @updateShow="attrShow = $event" />
    <OverlapCard />

    <TrackModal
      :show="trackShow"
      @updateShow="trackShow = $event"
      :data="trackData"
      @updateData="trackData = $event"
    />
  </template>
  <div v-else-if="!loading && !redirected" flex justify-center pt-80px>
    <div>快照数据缺失</div>
  </div>
</template>
