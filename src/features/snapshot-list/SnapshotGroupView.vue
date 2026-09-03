<script setup lang="ts">
import type { Snapshot } from '@/entities/snapshot/types';

import SnapshotActionCard from '@/features/snapshot-management/ui/SnapshotActionCard.vue';
import { getDevice } from '@/entities/snapshot/node';
import { screenshotStorage } from '@/entities/snapshot/storage';
import { useSnapshotMetadataStore } from '@/entities/snapshot/metadataStore';
import dayjs from 'dayjs';
import { buildSnapshotGroups } from './snapshot_group';
import { useSnapshotPreviewCache } from './useSnapshotPreviewCache';

const props = defineProps<{
  snapshots: Snapshot[];
  checkedRowKeys: number[];
  loading: boolean;
  updateSnapshots: () => Promise<void>;
}>();

const emit = defineEmits<{
  updateCheckedRowKeys: [value: number[]];
}>();

const { snapshotImportTime, snapshotViewedTime } = useSnapshotMetadataStore();
const groups = computed(() =>
  buildSnapshotGroups(props.snapshots, snapshotImportTime),
);
const checkedSet = computed(() => new Set(props.checkedRowKeys));
const expandedApps = shallowRef<Array<string | number>>([]);
const expandedActivities = shallowRef<Array<string | number>>([]);
const visibleCounts = shallowReactive<Record<string, number>>({});

const previewCache = useSnapshotPreviewCache({
  getScreenshot: (snapshotId) => screenshotStorage.getItem(snapshotId),
  maxEntries: 12,
});
const previewSnapshot = shallowRef<Snapshot>();
const previewX = shallowRef(0);
const previewY = shallowRef(0);
const previewPlacement = shallowRef<'left-start' | 'right-start'>(
  'right-start',
);
const previewMaxWidth = shallowRef(1);
const previewMaxHeight = shallowRef(1);
const previewShowDelay = 300;
let previewPointerX = 0;
let previewShowTaskId = 0;
let pendingPreviewSnapshot: Snapshot | undefined;
let pendingPreviewY = 0;

const clearPreviewShowTask = () => {
  if (previewShowTaskId) window.clearTimeout(previewShowTaskId);
  previewShowTaskId = 0;
  pendingPreviewSnapshot = undefined;
};
onScopeDispose(clearPreviewShowTask);

const updatePreviewHorizontalPosition = (pointerX: number) => {
  const viewportPadding = 12;
  const pointerGap = 10;
  const popoverChromeWidth = 32;
  const availableRight =
    window.innerWidth - pointerX - pointerGap - viewportPadding;
  const availableLeft = pointerX - pointerGap - viewportPadding;
  const placeRight = availableRight >= availableLeft;
  const availableWidth = placeRight ? availableRight : availableLeft;
  previewPlacement.value = placeRight ? 'right-start' : 'left-start';
  previewX.value = Math.min(
    window.innerWidth - viewportPadding,
    Math.max(
      viewportPadding,
      pointerX + (placeRight ? pointerGap : -pointerGap),
    ),
  );
  previewMaxWidth.value = Math.max(
    1,
    Math.min(window.innerWidth * 0.8, availableWidth - popoverChromeWidth),
  );
};
const updatePreviewViewportBounds = () => {
  updatePreviewHorizontalPosition(previewPointerX);
  previewMaxHeight.value = Math.max(1, Math.min(360, window.innerHeight - 48));
};
const showSnapshotPreview = (snapshot: Snapshot, event: MouseEvent) => {
  const trigger = event.currentTarget;
  clearPreviewShowTask();
  pendingPreviewSnapshot = snapshot;
  previewPointerX = event.clientX;
  pendingPreviewY =
    trigger instanceof HTMLElement
      ? trigger.getBoundingClientRect().top
      : event.clientY;
  updatePreviewViewportBounds();
  previewShowTaskId = window.setTimeout(() => {
    if (pendingPreviewSnapshot?.id != snapshot.id) return;
    previewShowTaskId = 0;
    pendingPreviewSnapshot = undefined;
    previewY.value = pendingPreviewY;
    previewSnapshot.value = snapshot;
    void previewCache.loadPreview(snapshot.id);
  }, previewShowDelay);
};
const moveSnapshotPreview = (event: MouseEvent) => {
  previewPointerX = event.clientX;
  updatePreviewHorizontalPosition(previewPointerX);
};
const hideSnapshotPreview = (snapshotId: number) => {
  if (pendingPreviewSnapshot?.id == snapshotId) clearPreviewShowTask();
  if (previewSnapshot.value?.id == snapshotId) {
    previewSnapshot.value = undefined;
  }
};
const handlePreviewViewportResize = () => {
  if (previewSnapshot.value) updatePreviewViewportBounds();
};
useEventListener(window, 'resize', handlePreviewViewportResize);

const getActivityKey = (appId: string, activityId: string) =>
  `${appId}::${activityId}`;
const getVisibleCount = (appId: string, activityId: string) =>
  visibleCounts[getActivityKey(appId, activityId)] ?? 50;
const showMore = (appId: string, activityId: string) => {
  const key = getActivityKey(appId, activityId);
  visibleCounts[key] = getVisibleCount(appId, activityId) + 50;
};

const setChecked = (ids: number[], checked: boolean) => {
  const next = new Set(props.checkedRowKeys);
  ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
  emit('updateCheckedRowKeys', [...next]);
};
const getCheckedState = (ids: number[]) => {
  const checkedCount = ids.filter((id) => checkedSet.value.has(id)).length;
  return {
    checked: ids.length > 0 && checkedCount === ids.length,
    indeterminate: checkedCount > 0 && checkedCount < ids.length,
  };
};
const getActivityIds = (snapshots: Snapshot[]) =>
  snapshots.map((snapshot) => snapshot.id);
const getAppIds = (activities: Array<{ snapshots: Snapshot[] }>) =>
  activities.flatMap((activity) => getActivityIds(activity.snapshots));
const getDeviceText = (snapshot: Snapshot) => {
  const device = getDevice(snapshot);
  return `${device.manufacturer} Android ${device.release || ''}`.trim();
};
</script>

<template>
  <NSpin
    :show="loading"
    class="min-h-0 flex-1 overflow-hidden"
    contentClass="h-full min-h-0 overflow-hidden"
  >
    <div v-if="!loading && !groups.length" py-40px text-center opacity-70>
      未找到匹配快照
    </div>
    <NScrollbar v-else class="h-full min-h-0">
      <NCollapse v-model:expandedNames="expandedApps" :accordion="false">
        <NCollapseItem
          v-for="group in groups"
          :key="group.appId"
          :name="group.appId"
        >
          <template #header>
            <div flex items-center gap-8px>
              <NCheckbox
                :checked="getCheckedState(getAppIds(group.activities)).checked"
                :indeterminate="
                  getCheckedState(getAppIds(group.activities)).indeterminate
                "
                @click.stop
                @update:checked="
                  setChecked(getAppIds(group.activities), $event)
                "
              />
              <NTag type="info" size="small">应用</NTag>
              <span class="gkd_code font-600">
                {{ `${group.appName} (${group.appId})` }}
              </span>
              <NTag size="small">{{ group.snapshotCount }} 个快照</NTag>
            </div>
          </template>

          <NCollapse
            v-model:expandedNames="expandedActivities"
            :accordion="false"
          >
            <NCollapseItem
              v-for="activity in group.activities"
              :key="getActivityKey(group.appId, activity.activityId)"
              :name="getActivityKey(group.appId, activity.activityId)"
            >
              <template #header>
                <div flex items-center gap-8px>
                  <NCheckbox
                    :checked="
                      getCheckedState(getActivityIds(activity.snapshots))
                        .checked
                    "
                    :indeterminate="
                      getCheckedState(getActivityIds(activity.snapshots))
                        .indeterminate
                    "
                    @click.stop
                    @update:checked="
                      setChecked(getActivityIds(activity.snapshots), $event)
                    "
                  />
                  <NTag type="success" size="small">Activity</NTag>
                  <span class="gkd_code">{{ activity.activityId }}</span>
                  <NTag size="small">
                    {{ activity.snapshots.length }} 个快照
                  </NTag>
                </div>
              </template>

              <div flex flex-col gap-6px>
                <div
                  v-for="snapshot in activity.snapshots.slice(
                    0,
                    getVisibleCount(group.appId, activity.activityId),
                  )"
                  :key="snapshot.id"
                  class="snapshot-group-row flex items-start gap-10px rounded-8px border border-solid px-10px py-7px"
                  :class="{
                    'snapshot-group-row-viewed':
                      snapshotViewedTime[snapshot.id],
                  }"
                >
                  <NCheckbox
                    :checked="checkedSet.has(snapshot.id)"
                    @update:checked="setChecked([snapshot.id], $event)"
                  />
                  <div
                    min-w-0
                    flex-1
                    cursor-default
                    @mouseenter="showSnapshotPreview(snapshot, $event)"
                    @mousemove="moveSnapshotPreview"
                    @mouseleave="hideSnapshotPreview(snapshot.id)"
                  >
                    <div flex flex-wrap items-center gap-6px>
                      <NTag size="small" type="warning">
                        {{ dayjs(snapshot.id).format('MM-DD HH:mm:ss') }}
                      </NTag>
                      <NTag
                        v-if="snapshotViewedTime[snapshot.id]"
                        size="small"
                        type="success"
                      >
                        已查看
                      </NTag>
                      <span class="font-600">{{ snapshot.activityId }}</span>
                    </div>
                    <div mt-3px text-12px opacity-65>
                      {{ getDeviceText(snapshot) }} ·
                      {{ snapshot.appInfo?.versionName || 'unknown' }} · 导入
                      {{
                        dayjs(
                          snapshotImportTime[snapshot.id] || snapshot.id,
                        ).format('YYYY-MM-DD HH:mm:ss')
                      }}
                    </div>
                  </div>
                  <SnapshotActionCard
                    class="ml-auto shrink-0"
                    :snapshot="snapshot"
                    :onDelete="updateSnapshots"
                  />
                </div>
                <div
                  v-if="
                    activity.snapshots.length >
                    getVisibleCount(group.appId, activity.activityId)
                  "
                  py-6px
                  text-center
                >
                  <NButton
                    size="small"
                    secondary
                    @click="showMore(group.appId, activity.activityId)"
                  >
                    显示更多
                  </NButton>
                </div>
              </div>
            </NCollapseItem>
          </NCollapse>
        </NCollapseItem>
      </NCollapse>
    </NScrollbar>
    <NPopover
      :show="!!previewSnapshot"
      :x="previewX"
      :y="previewY"
      :placement="previewPlacement"
      :flip="true"
      :showArrow="false"
      :contentStyle="{
        maxWidth: `${previewMaxWidth}px`,
        maxHeight: `${previewMaxHeight}px`,
        overflow: `hidden`,
        pointerEvents: `none`,
      }"
    >
      <div
        v-if="previewSnapshot"
        overflow-hidden
        :style="{
          maxWidth: `${previewMaxWidth}px`,
          maxHeight: `${previewMaxHeight}px`,
        }"
      >
        <img
          v-if="previewCache.urls[previewSnapshot.id]"
          :src="previewCache.urls[previewSnapshot.id]"
          class="block h-auto w-auto max-w-full rounded-6px"
          :style="{ maxHeight: `${previewMaxHeight}px` }"
          alt="快照预览"
        />
        <div v-else py-20px text-center opacity-70>
          {{
            previewCache.errors[previewSnapshot.id] ||
            (previewCache.loading[previewSnapshot.id]
              ? '预览加载中...'
              : '暂无预览图')
          }}
        </div>
      </div>
    </NPopover>
  </NSpin>
</template>

<style scoped>
.snapshot-group-row {
  border-color: var(--app-border);
  background: var(--app-panel);
}

.snapshot-group-row-viewed {
  border-color: var(--app-viewed-border);
  background: var(--app-viewed-bg);
}
</style>
