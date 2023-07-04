<script setup lang="ts">
import { toSelectorLiteral } from '@/utils';
import type { NaiveNode } from '@/utils/types';
import { NEllipsis, NTable, NTbody, NTd, NTh, NTr } from 'naive-ui';
import { computed, watch } from 'vue';
import DraggableCard from './DraggableCard.vue';
import { message } from '@/utils/discrete';
import { copy } from '@/utils/others';

const props = withDefaults(defineProps<{ focusNode: NaiveNode }>(), {});

const attrs = computed(() => {
  return Object.entries(props.focusNode.value.attr).map(([name, value]) => {
    value = toSelectorLiteral(value);
    return {
      name,
      value,
    };
  });
});
</script>

<template>
  <DraggableCard :initial-value="{ top: 90, right: 10 }" v-slot="{ onRef }">
    <NTable size="small" striped :single-line="false" class="gkd_code">
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
