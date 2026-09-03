<script lang="ts" setup>
import { loadingBar, message } from '@/utils/discrete';
import AttrCard from './AttrCard.vue';
import OverlapCard from './OverlapCard.vue';
import RuleCard from './RuleCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';
import { useSnapshotStore } from './snapshot';
import { useSnapshotUrlState } from './snapshot_url_state';
import TrackCard from '@/components/selector/TrackCard.vue';
import FullScreenDialog from '@/components/base/FullScreenDialog.vue';
import SettingsModal from '@/components/app/SettingsModal.vue';
import type { RouteLocationNormalized } from 'vue-router';
import PageBackButton from '@/components/base/PageBackButton.vue';
import type { DraggableCardValue } from '@/components/base/draggable';
import {
  loadSnapshotPanelLayouts,
  persistSnapshotPanelLayout,
  type SnapshotPanelName,
} from './panel_layout';

const route = useRoute();
const snapshotStore = useSnapshotStore();
const {
  snapshot,
  screenshotUrl,
  rootNode,
  loading,
  redirected,
  trackData,
  trackShow,
  loadFromRoute: loadSnapshotFromRoute,
  applyUrlFocus,
  closeTrack,
  clearTrack,
} = snapshotStore;
const snapshotUrlState = useSnapshotUrlState();
const searchRevision = shallowRef(0);
let activePath = ``;

const panelLayouts = shallowReactive(loadSnapshotPanelLayouts());
const setPanelLayout = (name: SnapshotPanelName, value: DraggableCardValue) => {
  const layout = persistSnapshotPanelLayout(name, value);
  if (!layout) return;
  panelLayouts[name] = layout;
};

const loadPageFromRoute = async (
  target: Pick<RouteLocationNormalized, 'path' | 'params' | 'query'>,
  initial = false,
) => {
  const pathChanged = initial || activePath != target.path;
  let failed = false;
  if (pathChanged) loadingBar.start();
  try {
    const urlChanged = await snapshotUrlState.loadFromRoute(target);
    if (snapshotUrlState.error.value) {
      message.error(snapshotUrlState.error.value.message);
    }
    if (pathChanged) {
      await loadSnapshotFromRoute(target);
      searchRevision.value += 1;
    } else if (urlChanged) {
      await applyUrlFocus();
      searchRevision.value += 1;
    }
    activePath = target.path;
  } catch (error) {
    failed = true;
    message.error(error instanceof Error ? error.message : String(error));
    if (pathChanged) loadingBar.error();
  } finally {
    if (pathChanged && !failed) loadingBar.finish();
  }
};

onBeforeMount(() => loadPageFromRoute(route, true));
onBeforeRouteUpdate((to) => loadPageFromRoute(to));

const getSessionBoolean = (key: string, fallback: boolean) => {
  const value = sessionStorage.getItem(key);
  return value == null ? fallback : value == 'true';
};
const searchShow = shallowRef(getSessionBoolean('searchShow', true));
const ruleShow = shallowRef(getSessionBoolean('ruleShow', false));
const attrShow = shallowRef(getSessionBoolean('attrShow', true));
const setPanelVisible = (
  key: 'searchShow' | 'ruleShow' | 'attrShow',
  visible: boolean,
) => {
  const target = { searchShow, ruleShow, attrShow }[key];
  if (!target) return;
  target.value = visible;
  sessionStorage.setItem(key, String(visible));
};

const settingsShow = shallowRef(false);
const setSettingsVisible = (visible: boolean) => {
  settingsShow.value = visible;
};
const redactionShow = shallowRef(false);
const setRedactionVisible = (visible: boolean) => {
  redactionShow.value = visible;
};
const setTrackVisible = (visible: boolean) => {
  if (!visible) closeTrack();
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
        <PageBackButton />
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setSettingsVisible(true)">
              <SvgIcon name="settings" />
            </NButton>
          </template>
          设置
        </NTooltip>
        <div />
        <NTooltip v-if="screenshotUrl" placement="right">
          <template #trigger>
            <NButton
              text
              aria-label="创建脱敏副本"
              @click="setRedactionVisible(true)"
            >
              <SvgIcon name="privacy" />
            </NButton>
          </template>
          创建脱敏副本
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('searchShow', !searchShow)">
              <SvgIcon name="search-list" />
            </NButton>
          </template>
          搜索面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('attrShow', !attrShow)">
              <SvgIcon name="prop" />
            </NButton>
          </template>
          属性面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('ruleShow', !ruleShow)">
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
      <ScreenshotCard
        :redactionShow="redactionShow"
        @update:redactionShow="setRedactionVisible"
      />
      <WindowCard class="flex-1" />
    </div>

    <SearchCard
      :key="searchRevision"
      :show="searchShow"
      :layout="panelLayouts.search"
      @updateShow="setPanelVisible('searchShow', $event)"
      @updateLayout="setPanelLayout('search', $event)"
    />
    <RuleCard
      :key="searchRevision"
      :show="ruleShow"
      :layout="panelLayouts.rule"
      @updateShow="setPanelVisible('ruleShow', $event)"
      @updateLayout="setPanelLayout('rule', $event)"
    />
    <AttrCard
      :show="attrShow"
      :layout="panelLayouts.attr"
      @updateShow="setPanelVisible('attrShow', $event)"
      @updateLayout="setPanelLayout('attr', $event)"
    />
    <OverlapCard
      :layout="panelLayouts.overlap"
      @updateLayout="setPanelLayout('overlap', $event)"
    />
    <FullScreenDialog
      :show="trackShow"
      @update:show="setTrackVisible"
      @closed="clearTrack"
    >
      <TrackCard
        v-if="trackData"
        class="app-panel"
        v-bind="trackData"
        @close="closeTrack"
      />
    </FullScreenDialog>
  </template>
  <div v-else-if="!loading && !redirected" page-size flex flex-col items-center>
    <div mt-160px>
      <span>快照数据缺失，</span>
      <a
        href="https://gkd.li/guide/snapshot#share-note"
        target="_blank"
        referrerpolicy="no-referrer"
        color-blue
        transition-colors
        hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      >
        查看分享须知
      </a>
    </div>
  </div>
  <SettingsModal :show="settingsShow" @update:show="setSettingsVisible" />
</template>
