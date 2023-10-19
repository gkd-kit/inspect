<script setup lang="ts">
import { copy } from '@/utils/others';
import type { RawNode } from '@/utils/types';
import { NEllipsis, NTable, NTbody, NTd, NTh, NTr, NTooltip } from 'naive-ui';
import { computed } from 'vue';
import DraggableCard from './DraggableCard.vue';

const props = withDefaults(defineProps<{ focusNode: RawNode }>(), {});

const lenAttrNames = [`text`, `desc`];
const attrs = computed(() => {
  return Object.entries(props.focusNode.attr)
    .map(([name, value]) => {
      const attr = {
        name,
        value: JSON.stringify(value),
      };
      if (lenAttrNames.includes(name)) {
        return [
          attr,
          {
            name: name + `.length`,
            value: JSON.stringify((value as string)?.length ?? null),
          },
        ];
      }
      return attr;
    })
    .flat();
});
</script>

<template>
  <DraggableCard :initialValue="{ top: 75, right: 10 }" v-slot="{ onRef }">
    <NTable
      size="small"
      striped
      :singleLine="false"
      class="gkd_code"
      :themeOverrides="{
        thPaddingSmall: '2px 4px',
        tdPaddingSmall: '2px 4px',
      }"
    >
      <thead cursor-move :ref="onRef">
        <NTr>
          <NTh> Name </NTh>
          <NTh> Value </NTh>
        </NTr>
      </thead>
      <NTbody>
        <NTr v-for="attrx in attrs" :key="attrx.name">
          <NTd>
            <span @click="copy(`${attrx.name}=${attrx.value}`)">
              {{ attrx.name }}
            </span>
          </NTd>
          <NTd>
            <NEllipsis
              style="
                width: 180px;
                min-width: max(12vw, 180px);
                direction: rtl;
                text-align: left;
              "
            >
              {{ attrx.value }}
            </NEllipsis>
          </NTd>
        </NTr>
        <NTr v-if="focusNode.quickFind !== undefined">
          <NTd> quickFind </NTd>
          <NTd>
            <NTooltip>
              <template #trigger>
                <span>{{ JSON.stringify(focusNode.quickFind) }}</span>
              </template>
              此节点是否可使用 quickFind
            </NTooltip>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </DraggableCard>
</template>
