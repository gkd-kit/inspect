<script setup lang="ts">
import { copy } from '@/utils/others';
import type { RawNode } from '@/utils/types';
import { NEllipsis, NTable, NTbody, NTd, NTh, NTr } from 'naive-ui';
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
            value: JSON.stringify((value as string)?.length || null),
          },
        ];
      }
      return attr;
    })
    .flat();
});
</script>

<template>
  <DraggableCard :initialValue="{ top: 90, right: 10 }" v-slot="{ onRef }">
    <NTable size="small" striped :singleLine="false" class="gkd_code">
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
            <NEllipsis style="width: 250px">
              {{ attrx.value }}
            </NEllipsis>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </DraggableCard>
</template>
