<script setup lang="tsx">
import type { NodeX, WindowX } from '@/utils/types';
import {
  NTree,
  NTable,
  NTbody,
  NTd,
  NTh,
  NThead,
  NTr,
  type TreeInst,
  type TreeOption,
} from 'naive-ui';
import { nextTick, ref, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{ windowX: WindowX; focusNode?: NodeX; skipKeys?: number[] }>(),
  { skipKeys: () => [] },
);
const emit = defineEmits<{
  (e: 'update:focusNode', data: NodeX): void;
  (e: 'update:skipKeys', data: number[]): void;
}>();

const defaultExpandedKeysRef = ref<number[]>([]);
watchEffect(async () => {
  if (!props.focusNode) return;
  const key = props.focusNode.key;
  let n = props.focusNode.parent;
  if (!n) {
    return;
  }
  const s = new Set(defaultExpandedKeysRef.value);
  while (n) {
    s.add(n.key);
    n = n.parent;
  }
  if (s.size == defaultExpandedKeysRef.value.length) {
    return;
  }
  defaultExpandedKeysRef.value = [...s];
  await nextTick();
  treeRef.value?.scrollTo({ key });
});

const treeRef = ref<TreeInst>();

const updateCheckedKeys = (
  keys: Array<string | number>,
  options: Array<TreeOption | null>,
  meta: {
    node: TreeOption | null;
    action: 'check' | 'uncheck';
  },
) => {
  emit('update:skipKeys', keys as number[]);
};

const renderSuffix = (node: NodeX) => {
  if (props.skipKeys.includes(node.key)) {
    return <div style={{ marginLeft: `10px`, color: `#ccc` }}>已隐藏</div>;
  }
};
</script>

<template>
  <div class="WindowCard" flex flex-col>
    <NTable size="small" striped :single-line="false">
      <NThead>
        <NTr>
          <NTh> AppId </NTh>
          <NTh> ActivityId </NTh>
        </NTr>
      </NThead>
      <NTbody>
        <NTr class="code-text">
          <NTd>{{ windowX.appId }}</NTd>
          <NTd>
            {{ windowX.activityId }}
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
    <NTree
      class="hello"
      ref="treeRef"
      checkable
      virtual-scroll
      @update:checked-keys="updateCheckedKeys"
      :filter="
        (_, node) => {
          return node.key == focusNode?.key;
        }
      "
      :data="[windowX.node]"
      :default-expanded-keys="defaultExpandedKeysRef"
      :default-checked-keys="skipKeys"
      :render-suffix="n => renderSuffix(n.option as NodeX)"
      :node-props="({ option }) => {
          return {
            onClick: () => {
              emit('update:focusNode', option as NodeX)
            },
            style: {
              color: option.key == focusNode?.key ? `#00F` : undefined,
            }
          }
        }
        "
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
