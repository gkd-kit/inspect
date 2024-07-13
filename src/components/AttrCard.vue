<script setup lang="ts">
import { copy } from '@/utils/others';
import type { RawNode } from '@/utils/types';
import { NEllipsis, NIcon, NTable, NTbody, NTd, NTooltip, NTr } from 'naive-ui';
import { computed } from 'vue';
import DraggableCard from './DraggableCard.vue';

const props = withDefaults(defineProps<{ focusNode: RawNode }>(), {});

const attrTip: Record<
  string,
  { show?: () => unknown; desc: string; type: 'info' | 'quickFind' }
> = {
  _id: {
    desc: `虚拟属性(真机不可用):生成快照访问节点顺序`,
    type: 'info',
  },
  _pid: { desc: `虚拟属性(真机不可用):父节点的 _id`, type: 'info' },
  depth: { desc: `使用此属性在某些应用上可能造成无限节点错误`, type: 'info' },
  id: {
    desc: `可快速查找`,
    type: 'quickFind',
    show() {
      return (
        (props.focusNode.quickFind || props.focusNode.idQf) &&
        props.focusNode.attr.id
      );
    },
  },
  vid: {
    desc: `可快速查找`,
    type: 'quickFind',
    show() {
      return (
        (props.focusNode.quickFind || props.focusNode.idQf) &&
        props.focusNode.attr.vid
      );
    },
  },
  text: {
    desc: `可快速查找`,
    type: 'quickFind',
    show() {
      return (
        (props.focusNode.quickFind || props.focusNode.textQf) &&
        props.focusNode.attr.text
      );
    },
  },
};

const lenAttrNames = [`text`, `desc`];
const attrs = computed(() => {
  return Object.entries(props.focusNode.attr)
    .map(([name, value]) => {
      const show = attrTip[name]?.show;
      const attr = {
        name,
        value,
        desc: JSON.stringify(value),
        tip: (show ? show() : true) ? attrTip[name] : undefined,
      };
      if (lenAttrNames.includes(name)) {
        return [
          attr,
          {
            name: name + `.length`,
            value: (value as string)?.length ?? null,
            desc: JSON.stringify((value as string)?.length ?? null),
            tip: undefined,
          },
        ];
      }
      return attr;
    })
    .flat();
});
</script>

<template>
  <DraggableCard
    :initialValue="{ top: 40, right: 10 }"
    v-slot="{ onRef }"
    class="box-shadow-dim"
  >
    <NTable
      size="small"
      striped
      :singleLine="false"
      class="gkd_code"
      :themeOverrides="{
        thPaddingSmall: '1px 3px',
        tdPaddingSmall: '1px 3px',
      }"
      ><thead>
        <tr :ref="onRef" cursor-move>
          <th>Name</th>
          <th>Value</th>
        </tr>
      </thead>
      <NTbody>
        <NTr v-for="attrx in attrs" :key="attrx.name">
          <NTd @click="copy(`${attrx.name}=${attrx.desc}`)">
            <div v-if="attrx.tip" flex justify-between items-center>
              <div>
                {{ attrx.name }}
              </div>
              <NTooltip>
                <template #trigger>
                  <NIcon size="16">
                    <svg viewBox="0 0 28 28" v-if="attrx.tip.type == 'info'">
                      <path
                        d="M15 8a1 1 0 1 1-2 0a1 1 0 0 1 2 0zm-1.75 3.75v7.5a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-1.5 0zM2 14C2 7.373 7.373 2 14 2s12 5.373 12 12s-5.373 12-12 12S2 20.627 2 14zM14 3.5C8.201 3.5 3.5 8.201 3.5 14S8.201 24.5 14 24.5S24.5 19.799 24.5 14S19.799 3.5 14 3.5z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <svg
                      viewBox="0 0 1024 1024"
                      v-else-if="attrx.tip.type == 'quickFind'"
                    >
                      <path
                        d="M722.500267 330.888533l-273.408 273.408-147.729067-147.729066a42.018133 42.018133 0 1 0-59.426133 59.426133l177.425066 177.493333a41.984 41.984 0 0 0 59.426134 0L781.9264 390.314667a42.001067 42.001067 0 0 0-59.392-59.426134h-0.034133zM78.506667 783.496533a508.279467 508.279467 0 0 0 319.0784 226.986667C530.773333 1041.066667 667.886933 1017.924267 783.701333 945.390933a508.279467 508.279467 0 0 0 226.986667-319.0784 508.279467 508.279467 0 0 0-65.058133-386.116266C848.554667 85.367467 681.710933 0.341333 511.214933 0.341333a508.6208 508.6208 0 0 0-270.813866 77.960534A36.864 36.864 0 0 0 279.552 140.629333C484.113067 12.288 755.029333 74.581333 883.268267 279.278933a434.9952 434.9952 0 0 1 55.739733 330.5472 435.029333 435.029333 0 0 1-194.3552 273.134934 435.746133 435.746133 0 0 1-330.581333 55.773866A435.165867 435.165867 0 0 1 140.936533 744.379733a436.770133 436.770133 0 0 1-5.666133-456.055466 36.829867 36.829867 0 0 0-63.317333-37.546667A510.1568 510.1568 0 0 0 78.506667 783.530667v-0.034134z"
                        fill="currentColor"
                      ></path>
                    </svg>
                  </NIcon>
                </template>
                {{ attrx.tip.desc }}
              </NTooltip>
            </div>
            <template v-else>
              {{ attrx.name }}
            </template>
          </NTd>
          <NTd>
            <NEllipsis
              class="w-[calc(var(--gkd-width)*0.12)]"
              :class="{
                'text-left direction-rtl': attrx.name == 'id',
                'opacity-50': attrx.value === null,
              }"
            >
              {{ attrx.desc }}
            </NEllipsis>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
  </DraggableCard>
</template>
