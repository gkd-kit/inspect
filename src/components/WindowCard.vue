<script setup lang="tsx">
import { getDevice, getNodeLabel } from '@/utils/node';
import { copy } from '@/utils/others';
import type { RawNode, Snapshot } from '@/utils/types';
import {
  NTable,
  NTbody,
  NTd,
  NTh,
  NThead,
  NTr,
  NTree,
  NEllipsis,
  type TreeInst,
  type TreeOption,
} from 'naive-ui';
import { HTMLAttributes, nextTick, shallowRef, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    rootNode: RawNode;
    focusNode?: RawNode;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {
    onUpdateFocusNode: () => () => {},
  },
);

const defaultExpandedKeys = shallowRef<number[]>([]);
watchEffect(async () => {
  if (!props.focusNode) return;
  const key = props.focusNode.id;
  let n = props.focusNode.parent;
  if (!n) {
    return;
  }
  const s = new Set(defaultExpandedKeys.value);
  while (n) {
    s.add(n.id);
    n = n.parent;
  }
  if (s.size == defaultExpandedKeys.value.length) {
    return;
  }
  defaultExpandedKeys.value = [...s];
  await nextTick();
  treeRef.value?.scrollTo({ key });
});

const treeRef = shallowRef<TreeInst>();

const updateCheckedKeys = (
  keys: Array<string | number>,
  options: Array<TreeOption | null>,
  meta: {
    node: TreeOption | null;
    action: 'check' | 'uncheck';
  },
) => {};

const treeFilter = (pattern: string, node: RawNode) => {
  return node.id === props.focusNode?.id;
};
const treeNodeProps = (info: {
  option: RawNode;
}): HTMLAttributes & Record<string, unknown> => {
  return {
    onClick: () => {
      props.onUpdateFocusNode(info.option);
    },
    style: {
      color: info.option.id == props.focusNode?.id ? `#00F` : void 0,
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
</script>

<template>
  <div flex flex-col>
    <NTable
      size="small"
      striped
      :singleLine="false"
      class="table-fixed"
      :themeOverrides="{
        thPaddingSmall: '2px 4px',
        tdPaddingSmall: '2px 4px',
      }"
    >
      <NThead>
        <NTr>
          <NTh class="w-140px"> Device </NTh>
          <NTh class="w-100px"> Name </NTh>
          <NTh class="w-100px"> VersionName </NTh>
          <NTh class="w-100px"> VersionCode </NTh>
          <NTh class="w-150px"> AppId </NTh>
          <NTh> ActivityId </NTh>
          <NTh class="w-175px"> 操作 </NTh>
        </NTr>
      </NThead>
      <NTbody>
        <NTr>
          <NTd class="whitespace-nowrap">
            {{
              `${getDevice(snapshot).manufacturer} Android ${
                getDevice(snapshot).release || ``
              }`
            }}
          </NTd>
          <NTd class="whitespace-nowrap" @click="copy(snapshot.appName)">
            <NEllipsis>
              {{ snapshot.appName }}
            </NEllipsis>
          </NTd>
          <NTd class="whitespace-nowrap" @click="copy(snapshot.appVersionName)">
            <NEllipsis>
              {{ snapshot.appVersionName }}
            </NEllipsis>
          </NTd>
          <NTd
            class="whitespace-nowrap"
            @click="copy(snapshot.appVersionCode.toString())"
          >
            <NEllipsis>
              {{ snapshot.appVersionCode }}
            </NEllipsis>
          </NTd>
          <NTd class="whitespace-nowrap" @click="copy(snapshot.appId)">
            <NEllipsis>
              {{ snapshot.appId }}
            </NEllipsis>
          </NTd>
          <NTd @click="copy(snapshot.activityId)" class="break-words">
            <NEllipsis>
              {{ snapshot.activityId }}
            </NEllipsis>
          </NTd>
          <NTd>
            <slot></slot>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
    <NTree
      ref="treeRef"
      virtualScroll
      showLine
      @update:checked-keys="updateCheckedKeys"
      keyField="id"
      :defaultExpandedKeys="defaultExpandedKeys"
      :data="[rootNode as any]"
      :filter="(treeFilter as any)"
      :nodeProps="(treeNodeProps as any)"
      :renderLabel="(renderLabel as any)"
      style="--n-border-color: rgb(239, 239, 245)"
    />
  </div>
</template>

<style scoped lang="scss">
.WindowCard {
  .n-tree {
    overflow: scroll;
  }

  :deep(.n-tree-node-content__text) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 800px;
  }
}
</style>
