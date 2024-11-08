<script setup lang="tsx">
import ActionCard from '@/components/ActionCard.vue';
import GapList from '@/components/GapList';
import { message } from '@/utils/discrete';
import {
  getAppInfo,
  getDevice,
  getGkdAppInfo,
  getNodeLabel,
} from '@/utils/node';
import { copy, delay } from '@/utils/others';
import type { RawNode, Snapshot } from '@/utils/types';
import type { TreeInst } from 'naive-ui';
import type { HTMLAttributes, ShallowRef } from 'vue';

const router = useRouter();

const snapshotStore = useSnapshotStore();
const { updateFocusNode } = snapshotStore;
const snapshotRefs = storeToRefs(snapshotStore);
const snapshot = snapshotRefs.snapshot as ShallowRef<Snapshot>;
const rootNode = snapshotRefs.rootNode as ShallowRef<RawNode>;
const { focusNode, focusTime } = snapshotRefs;

const expandedKeys = shallowRef<number[]>([]);
watch([() => focusNode.value, () => focusTime.value], async () => {
  if (!focusNode.value) return;
  const key = focusNode.value.id;
  nextTick().then(async () => {
    await delay(100);
    if (key === focusNode.value?.id) {
      treeRef.value?.scrollTo({ key, behavior: 'smooth', debounce: true });
    }
  });
  let parent = focusNode.value.parent;
  if (!parent) {
    return;
  }
  const s = new Set(expandedKeys.value);
  while (parent) {
    s.add(parent.id);
    parent = parent.parent;
  }
  if (
    s.size == expandedKeys.value.length &&
    expandedKeys.value.every((v) => s.has(v))
  ) {
    return;
  }
  expandedKeys.value = [...s];
});

const treeRef = shallowRef<TreeInst>();

const treeFilter = (pattern: string, node: RawNode) => {
  return node.id === focusNode.value?.id;
};
const treeNodeProps = (info: {
  option: RawNode;
}): HTMLAttributes & Record<string, unknown> => {
  const qf = info.option.idQf || info.option.textQf || info.option.quickFind;
  return {
    onClick: () => {
      updateFocusNode(info.option);
    },
    style: {
      color: info.option.id == focusNode.value?.id ? `#00F` : undefined,
      fontWeight: qf ? `bold` : undefined,
    },
  };
};

const renderLabel = (info: {
  option: RawNode;
  checked: boolean;
  selected: boolean;
}) => {
  return getNodeLabel(info.option);
};

const deviceName = computed(() => {
  return `${getDevice(snapshot.value).manufacturer} Android ${getDevice(snapshot.value).release || ``}`;
});

const isSystem = computed(() => {
  return getAppInfo(snapshot.value).isSystem;
});
const activityId = computed(() => {
  if (!snapshot.value.activityId || !snapshot.value.appId) return '';
  if (
    snapshot.value.activityId.startsWith(snapshot.value.appId) &&
    snapshot.value.activityId.length > snapshot.value.appId.length
  ) {
    return snapshot.value.activityId.substring(snapshot.value.appId.length);
  }
  return snapshot.value.activityId;
});

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};
</script>

<template>
  <div flex flex-col>
    <div flex items-center px-8px>
      <GapList flex flex-wrap items-center gap-8px gkd_code>
        <template #gap>
          <div w-1px bg-gray h-12px></div>
        </template>
        <NTooltip>
          <template #trigger>
            <div @click="copy(deviceName)">
              {{ deviceName }}
            </div>
          </template>
          设备名称
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <div
              :class="{
                'opacity-50': !getGkdAppInfo(snapshot).versionName,
              }"
            >
              {{ getGkdAppInfo(snapshot).versionName || 'null' }}
            </div>
          </template>
          GKD 版本
        </NTooltip>

        <div flex items-center gap-2px max-w-120px>
          <NTooltip v-if="isSystem">
            <template #trigger>
              <NIcon :size="14">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M19.43 12.98c.04-.32.07-.64.07-.98c0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.566.566 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98c0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73c0 .21-.02.43-.05.73l-.14 1.13l.89.7l1.08.84l-.7 1.21l-1.27-.51l-1.04-.42l-.9.68c-.43.32-.84.56-1.25.73l-1.06.43l-.16 1.13l-.2 1.35h-1.4l-.19-1.35l-.16-1.13l-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7l-1.06.43l-1.27.51l-.7-1.21l1.08-.84l.89-.7l-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13l-.89-.7l-1.08-.84l.7-1.21l1.27.51l1.04.42l.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43l.16-1.13l.2-1.35h1.39l.19 1.35l.16 1.13l1.06.43c.43.18.83.41 1.23.71l.91.7l1.06-.43l1.27-.51l.7 1.21l-1.07.85l-.89.7l.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"
                    fill="currentColor"
                  ></path>
                </svg>
              </NIcon>
            </template>
            系统应用
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <div @click="copy(getAppInfo(snapshot).name)">
                {{ getAppInfo(snapshot).name }}
              </div>
            </template>
            应用名称
          </NTooltip>
        </div>

        <NTooltip>
          <template #trigger>
            <div @click="copy(getAppInfo(snapshot).versionName)">
              {{ getAppInfo(snapshot).versionName }}
            </div>
          </template>
          版本名称
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <div @click="copy(getAppInfo(snapshot).versionCode.toString())">
              {{ getAppInfo(snapshot).versionCode }}
            </div>
          </template>
          版本代码
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <div @click="copy(snapshot.appId)">
              {{ snapshot.appId }}
            </div>
          </template>
          应用ID
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <div
              @click="copy(activityId)"
              :class="{
                'opacity-50': !activityId,
              }"
            >
              {{ activityId || 'null' }}
            </div>
          </template>
          界面ID
        </NTooltip>
      </GapList>
      <div flex-1></div>
      <ActionCard
        class="ml-8px"
        :snapshot="snapshot"
        @delete="onDelete"
        :showPreview="false"
      />
    </div>
    <div h-1px mt-4px bg="#efeff5"></div>
    <NTree
      ref="treeRef"
      virtualScroll
      showLine
      keyField="id"
      v-model:expandedKeys="expandedKeys"
      :data="[rootNode as any]"
      :filter="(treeFilter as any)"
      :nodeProps="(treeNodeProps as any)"
      :renderLabel="(renderLabel as any)"
    />
  </div>
</template>
