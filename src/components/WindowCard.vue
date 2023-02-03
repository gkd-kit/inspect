<script setup lang="ts">
import type { NodeX, WindowX } from '@/types';
import {
  NTree,
  NTable,
  NTbody,
  NTd,
  NTh,
  NThead,
  NTr,
  type TreeInst,
} from 'naive-ui';
import { nextTick, ref, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{ windowX: WindowX; focusNode: NodeX }>(),
  {}
);
const emit = defineEmits<{
  (e: 'update:focusNode', data: NodeX): void;
}>();

const defaultExpandedKeysRef = ref<number[]>([]);
watchEffect(async () => {
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
</script>

<template>
  <div class="WindowCard">
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
      ref="treeRef"
      virtual-scroll
      :filter="
        (_, node) => {
          return node.key === focusNode.key;
        }
      "
      :data="[windowX.node]"
      :default-expanded-keys="defaultExpandedKeysRef"
      :node-props="
        ({ option }) => ({
          onClick: () => {
            emit('update:focusNode', option as NodeX)
          },
          style:option.key== focusNode.key?({
            color:`#00F`,
            
          }):undefined
        })
      "
    />
  </div>
</template>

<style scoped lang="scss">
.WindowCard {
  display: flex;
  flex-direction: column;
  .code-text {
    font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace;
  }
  .n-tree {
    overflow: scroll;
  }
}
</style>
