<script setup lang="tsx">
import ActionCard from '@/components/ActionCard.vue';
import GapList from '@/components/GapList';
import { message } from '@/utils/discrete';
import {
  getAppInfo,
  getDevice,
  getGkdAppInfo,
  getNodeLabel,
  getNodeStyle,
} from '@/utils/node';
import { copy, delay } from '@/utils/others';
import type { TreeInst } from 'naive-ui';
import type { HTMLAttributes, ShallowRef } from 'vue';
import { useSnapshotStore } from './snapshot';

const router = useRouter();

const snapshotStore = useSnapshotStore();
const { updateFocusNode, focusNode, subscribeFocus } = snapshotStore;
const snapshot = snapshotStore.snapshot as ShallowRef<Snapshot>;
const rootNode = snapshotStore.rootNode as ShallowRef<RawNode>;

const expandedKeys = shallowRef<number[]>([]);
const selectedKeys = shallowRef<number[]>([]);
const treeContainer = useTemplateRef('treeContainerRef');
const syncTreeToFocus = async (node: RawNode, scrollTree: boolean) => {
  const key = node.id;
  selectedKeys.value = [key];
  let parent = node.parent;
  const s = new Set(expandedKeys.value);
  while (parent) {
    s.add(parent.id);
    parent = parent.parent;
  }
  if (
    s.size != expandedKeys.value.length ||
    !expandedKeys.value.every((v) => s.has(v))
  ) {
    expandedKeys.value = [...s];
  }
  if (!scrollTree) return;
  await nextTick();
  await delay(300);
  if (key !== focusNode.value?.id || !treeContainer.value) return;
  const nodeRef = treeContainer.value.querySelector(`[data-node-id="${key}"]`);
  if (nodeRef) {
    nodeRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    await delay(300);
    treeRef.value?.scrollTo({ key, behavior: 'smooth', debounce: true });
  }
};

let unsubscribeFocus: (() => boolean) | undefined;
onMounted(() => {
  unsubscribeFocus = subscribeFocus((node, scrollTree) => {
    void syncTreeToFocus(node, scrollTree);
  });
});
onBeforeUnmount(() => unsubscribeFocus?.());

const treeRef = shallowRef<TreeInst>();

const treeFilter = (pattern: string, node: RawNode) => {
  return node.id === focusNode.value?.id;
};
const treeNodeProps = (info: {
  option: RawNode;
}): HTMLAttributes & Record<string, unknown> => {
  const style = getNodeStyle(info.option, focusNode.value);
  return {
    onClick: () => {
      updateFocusNode(info.option, { scrollTree: false });
    },
    style: {
      '--n-node-text-color': style.color,
      ...style,
    },
    class: 'whitespace-nowrap',
    'data-node-id': String(info.option.id),
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
  const v = snapshot.value.activityId;
  const appId = snapshot.value.appId;
  if (!v || !appId) return '';
  if (v.startsWith(appId) && v[appId.length] === '.') {
    return v.substring(appId.length);
  }
  return v;
});

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};
const gkdVersionName = computed(() => {
  const v = getGkdAppInfo(snapshot.value).versionName;
  return v ? `GKD@${v}` : undefined;
});
</script>

<template>
  <div flex flex-col overflow-hidden>
    <div flex items-center px-8px>
      <GapList class="flex flex-wrap items-center gap-8px gkd_code">
        <template #gap>
          <div w-1px bg-gray h-12px />
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
                'opacity-50': !gkdVersionName,
              }"
            >
              {{ gkdVersionName || 'null' }}
            </div>
          </template>
          GKD 版本
        </NTooltip>

        <div flex items-center gap-2px max-w-120px>
          <NTooltip v-if="isSystem">
            <template #trigger>
              <SvgIcon name="system" />
            </template>
            {{ `${getAppInfo(snapshot).name} 是一个系统应用` }}
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
              :class="{
                'opacity-50': !activityId,
              }"
              @click="copy(activityId)"
            >
              {{ activityId || 'null' }}
            </div>
          </template>
          界面ID
        </NTooltip>
      </GapList>
      <div flex-1 />
      <ActionCard
        class="ml-8px"
        :snapshot="snapshot"
        :showPreview="false"
        @delete="onDelete"
      />
    </div>
    <div h-1px mt-4px bg="#efeff5" />
    <div ref="treeContainerRef" flex-1 min-h-0>
      <NTree
        ref="treeRef"
        v-model:expandedKeys="expandedKeys"
        v-model:selectedKeys="selectedKeys"
        class="h-full"
        virtualScroll
        showLine
        blockLine
        keyField="id"
        :data="[rootNode as any]"
        :filter="(treeFilter as any)"
        :nodeProps="(treeNodeProps as any)"
        :renderLabel="(renderLabel as any)"
      />
    </div>
  </div>
</template>
