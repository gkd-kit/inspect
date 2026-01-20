<script lang="ts" setup>
import { loadingBar, message } from '@/utils/discrete';
import AttrCard from './AttrCard.vue';
import OverlapCard from './OverlapCard.vue';
import RuleCard from './RuleCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';
import { useSnapshotStore } from './snapshot';
import TrackCard from '@/components/TrackCard.vue';
import FullScreenDialog from '@/components/FullScreenDialog.vue';

const { snapshot, rootNode, loading, redirected, trackData, trackShow } =
  useSnapshotStore();

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
    <div page-size flex gap-5px>
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
            <NButton text @click="clickSettings">
              <SvgIcon name="settings" />
            </NButton>
          </template>
          设置
        </NTooltip>
        <div />
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
            <NButton text @click="attrShow = !attrShow">
              <SvgIcon name="prop" />
            </NButton>
          </template>
          属性面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="ruleShow = !ruleShow">
              <SvgIcon name="test" />
            </NButton>
          </template>
          测试规则
        </NTooltip>
        <div />
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
    <FullScreenDialog v-model:show="trackShow" @closed="trackData = undefined">
      <TrackCard
        v-if="trackData"
        class="bg-white"
        v-bind="trackData"
        @close="trackShow = false"
      />
    </FullScreenDialog>
  </template>
  <div
    v-else-if="!loading && !redirected"
    page-size
    pt-80px
    flex
    flex-col
    items-center
    justify-center
  >
    <div mb-8px>
      <span>快照数据缺失，</span>
      <a
        href="https://gkd.li/guide/snapshot#share-note"
        target="_blank"
        referrerpolicy="no-referrer"
        >分享须知</a
      >
    </div>
  </div>
</template>
