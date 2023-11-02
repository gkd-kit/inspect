<script setup lang="ts">
import { copy } from '@/utils/others';
import type { RawNode } from '@/utils/types';
import {
  NEllipsis,
  NTable,
  NTbody,
  NTd,
  NTh,
  NTr,
  NIcon,
  NSpace,
  NTooltip,
} from 'naive-ui';
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

const getNameDesc = (n: string) => {
  if (n == '_id') {
    return `虚拟属性:生成快照访问节点顺序`;
  }
  if (n == '_pid') {
    return `虚拟属性:父节点的 _id`;
  }
};
</script>

<template>
  <DraggableCard :initialValue="{ top: 75, right: 10 }" v-slot="{ onRef }">
    <div flex p-4px gap-10px style="background: #e6e6e6">
      <NTooltip v-if="focusNode.quickFind">
        <template #trigger>
          <NIcon size="16">
            <svg viewBox="0 0 1024 1024">
              <path
                d="M722.500267 330.888533l-273.408 273.408-147.729067-147.729066a42.018133 42.018133 0 1 0-59.426133 59.426133l177.425066 177.493333a41.984 41.984 0 0 0 59.426134 0L781.9264 390.314667a42.001067 42.001067 0 0 0-59.392-59.426134h-0.034133zM78.506667 783.496533a508.279467 508.279467 0 0 0 319.0784 226.986667C530.773333 1041.066667 667.886933 1017.924267 783.701333 945.390933a508.279467 508.279467 0 0 0 226.986667-319.0784 508.279467 508.279467 0 0 0-65.058133-386.116266C848.554667 85.367467 681.710933 0.341333 511.214933 0.341333a508.6208 508.6208 0 0 0-270.813866 77.960534A36.864 36.864 0 0 0 279.552 140.629333C484.113067 12.288 755.029333 74.581333 883.268267 279.278933a434.9952 434.9952 0 0 1 55.739733 330.5472 435.029333 435.029333 0 0 1-194.3552 273.134934 435.746133 435.746133 0 0 1-330.581333 55.773866A435.165867 435.165867 0 0 1 140.936533 744.379733a436.770133 436.770133 0 0 1-5.666133-456.055466 36.829867 36.829867 0 0 0-63.317333-37.546667A510.1568 510.1568 0 0 0 78.506667 783.530667v-0.034134z"
              ></path>
            </svg>
          </NIcon>
        </template>
        可快速查找
      </NTooltip>
      <div h-16px flex-1 :ref="onRef" cursor-move></div>
    </div>
    <NTable
      size="small"
      striped
      :singleLine="false"
      class="gkd_code"
      :themeOverrides="{
        thPaddingSmall: '1px 3px',
        tdPaddingSmall: '1px 3px',
      }"
    >
      <NTbody>
        <NTr v-for="attrx in attrs" :key="attrx.name">
          <NTd @click="copy(`${attrx.name}=${attrx.value}`)">
            <div
              v-if="attrx.name.startsWith(`_`)"
              flex
              flex-justify-between
              flex-items-center
            >
              <div>
                {{ attrx.name }}
              </div>
              <NTooltip>
                <template #trigger>
                  <NIcon size="16">
                    <svg viewBox="0 0 28 28">
                      <g fill="none">
                        <path
                          d="M15 8a1 1 0 1 1-2 0a1 1 0 0 1 2 0zm-1.75 3.75v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0zM2 14C2 7.373 7.373 2 14 2s12 5.373 12 12s-5.373 12-12 12S2 20.627 2 14zM14 3.5C8.201 3.5 3.5 8.201 3.5 14S8.201 24.5 14 24.5S24.5 19.799 24.5 14S19.799 3.5 14 3.5z"
                          fill="currentColor"
                        ></path>
                      </g>
                    </svg>
                  </NIcon>
                </template>
                {{ getNameDesc(attrx.name) }}
              </NTooltip>
            </div>
            <template v-else>
              {{ attrx.name }}
            </template>
          </NTd>
          <NTd>
            <NEllipsis
              style="
                width: 180px;
                min-width: max(12vw, 180px);
                direction: rtl;
                text-align: left;
              "
              v-if="attrx.name == 'id'"
            >
              {{ attrx.value }}
            </NEllipsis>
            <NEllipsis v-else style="width: 180px; min-width: max(12vw, 180px)">
              {{ attrx.value }}
            </NEllipsis>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </DraggableCard>
</template>
