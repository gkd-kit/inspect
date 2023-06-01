<script setup lang="ts">
import { toSelectorLiteral } from '@/utils';
import type { NaiveNode } from '@/utils/types';
import { NEllipsis, NTable, NTbody, NTd, NTh, NTr } from 'naive-ui';
import { computed } from 'vue';
import DraggableCard from './DraggableCard.vue';

const props = withDefaults(defineProps<{ focusNode: NaiveNode }>(), {});

const attrs = computed(() => {
  return Object.entries(props.focusNode.value.attr).map(([name, value]) => {
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
        <NTr v-for="(attrx, index) in attrs" :key="index">
          <NTd>{{ attrx.name }}</NTd>
          <NTd>
            <NEllipsis style="width: 250px">
              {{ toSelectorLiteral(attrx.value) }}
            </NEllipsis>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </DraggableCard>
</template>
