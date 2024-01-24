<script setup lang="tsx">
import { getDevice, getNodeLabel } from '@/utils/node';
import { copy, delay } from '@/utils/others';
import type { RawNode, Snapshot } from '@/utils/types';
import {
  NEllipsis,
  NTable,
  NTbody,
  NTd,
  NTh,
  NThead,
  NTr,
  NTree,
} from 'naive-ui';
import type { TreeInst } from 'naive-ui';
import { nextTick, shallowRef, watch } from 'vue';
import type { HTMLAttributes } from 'vue';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    rootNode: RawNode;
    focusNode?: RawNode;
    focusCount: number;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {
    onUpdateFocusNode: () => () => {},
  },
);

const expandedKeys = shallowRef<number[]>([]);
watch([() => props.focusNode, () => props.focusCount], async () => {
  if (!props.focusNode) return;
  const key = props.focusNode.id;
  nextTick().then(async () => {
    await delay(100);
    if (key === props.focusNode?.id) {
      treeRef.value?.scrollTo({ key, behavior: 'smooth', debounce: true });
    }
  });
  let parent = props.focusNode.parent;
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
  return node.id === props.focusNode?.id;
};
const treeNodeProps = (info: {
  option: RawNode;
}): HTMLAttributes & Record<string, unknown> => {
  const qf = info.option.idQf || info.option.textQf || info.option.quickFind;
  return {
    onClick: () => {
      props.onUpdateFocusNode(info.option);
    },
    style: {
      color: info.option.id == props.focusNode?.id ? `#00F` : undefined,
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
      keyField="id"
      v-model:expandedKeys="expandedKeys"
      :data="[rootNode as any]"
      :filter="(treeFilter as any)"
      :nodeProps="(treeNodeProps as any)"
      :renderLabel="(renderLabel as any)"
    />
  </div>
</template>
