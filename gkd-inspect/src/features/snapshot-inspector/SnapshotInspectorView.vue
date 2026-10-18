<script lang="ts" setup>
import { NButton, NTooltip } from 'naive-ui';
import { shallowReactive, shallowRef } from 'vue';
import { useSnapshotRoute } from './snapshot_route';

import GkSvg from '@/shared/ui/GkSvg.vue';
import { loadingBar, message } from '@/shared/services/feedback';
import AttrCard from './AttrCard.vue';
import OverlapCard from './OverlapCard.vue';
import RuleCard from './RuleCard.vue';
import ScreenshotCard from './ScreenshotCard.vue';
import SearchCard from './SearchCard.vue';
import WindowCard from './WindowCard.vue';
import { useSnapshotStore } from './snapshot';
import SelectorTrackCard from '@/entities/selector/ui/SelectorTrackCard.vue';
import GkFullscreenDialog from '@/shared/ui/GkFullscreenDialog.vue';
import SettingsModal from '@/features/settings/SettingsModal.vue';
import type { RouteLocationNormalized } from 'vue-router';
import PageBackButton from '@/features/navigation/PageBackButton.vue';
import type { GkDraggableCardValue } from '@/shared/ui/GkDraggableCard.ts';
import {
  loadSnapshotPanelLayouts,
  persistSnapshotPanelLayout,
  type SnapshotPanelName,
} from './panel_layout';

const snapshotStore = useSnapshotStore();
const {
  snapshot,
  screenshotUrl,
  rootNode,
  loading,
  searchRevision,
  trackData,
  trackShow,
  loadFromRoute: loadSnapshotFromRoute,
  cancelLoad,
  closeTrack,
  clearTrack,
} = snapshotStore;

const panelLayouts = shallowReactive(loadSnapshotPanelLayouts());
const setPanelLayout = (
  name: SnapshotPanelName,
  value: GkDraggableCardValue,
) => {
  const layout = persistSnapshotPanelLayout(name, value);
  if (!layout) return;
  panelLayouts[name] = layout;
};

const loadPageFromRoute = async (target: RouteLocationNormalized) => {
  loadingBar.start();
  const result = await loadSnapshotFromRoute(target);
  if (result.status === 'stale') return;
  if (result.status === 'error') {
    message.error(result.error.message);
    loadingBar.error();
    return;
  }
  if (result.value) message.error(result.value.message);
  loadingBar.finish();
};
const cancelPageLoad = () => {
  cancelLoad();
  loadingBar.finish();
};
useSnapshotRoute((target) => {
  void loadPageFromRoute(target);
}, cancelPageLoad);
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
    <div class="w-(--gkd-w) h-(--gkd-h) flex gap-[5px]">
      <div
        class="[--svg-h:24px] w-[40px] py-[12px] flex flex-col items-center gap-[16px]"
      >
        <PageBackButton />
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setSettingsVisible(true)">
              <GkSvg name="settings" />
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
              <GkSvg name="privacy" />
            </NButton>
          </template>
          创建脱敏副本
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('searchShow', !searchShow)">
              <GkSvg name="search-list" />
            </NButton>
          </template>
          搜索面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('attrShow', !attrShow)">
              <GkSvg name="prop" />
            </NButton>
          </template>
          属性面板
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <NButton text @click="setPanelVisible('ruleShow', !ruleShow)">
              <GkSvg name="test" />
            </NButton>
          </template>
          测试规则
        </NTooltip>
        <div />
        <NTooltip placement="right">
          <template #trigger>
            <a
              class="flex justify-center"
              href="https://github.com/orgs/gkd-kit/discussions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <GkSvg name="discussion" />
              </NButton>
            </a>
          </template>
          讨论交流
        </NTooltip>
        <NTooltip placement="right">
          <template #trigger>
            <a
              class="flex justify-center"
              href="https://gkd.li/guide/snapshot#share-note"
              target="_blank"
              rel="noopener noreferrer"
            >
              <NButton text>
                <GkSvg name="warn" />
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
    <GkFullscreenDialog
      :show="trackShow"
      @update:show="setTrackVisible"
      @closed="clearTrack"
    >
      <SelectorTrackCard
        v-if="trackData"
        class="border-(--app-border)! bg-(--app-panel)! text-(--app-text)"
        v-bind="trackData"
        @close="closeTrack"
      />
    </GkFullscreenDialog>
  </template>
  <div
    v-else-if="!loading"
    class="w-(--gkd-w) h-(--gkd-h) flex flex-col items-center"
  >
    <div class="mt-[160px]">
      <span>快照数据缺失，</span>
      <a
        class="text-blue-400 transition-colors hover:text-[rgb(from_currentColor_r_g_b_/_50%)]"
        href="https://gkd.li/guide/snapshot#share-note"
        target="_blank"
        referrerpolicy="no-referrer"
      >
        查看分享须知
      </a>
    </div>
  </div>
  <SettingsModal :show="settingsShow" @update:show="setSettingsVisible" />
</template>
