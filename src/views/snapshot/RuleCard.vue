<script setup lang="ts">
import DraggableCard from '@/components/base/DraggableCard.vue';
import type { DraggableCardValue } from '@/components/base/draggable';
import { getNodeLabel, getNodeStyle } from '@/domain/snapshot/node';
import { buildEmptyFn } from '@/utils/others';
import { gkdWidth, vw } from './size';
import type { ShallowRef } from 'vue';
import {
  evaluateRuleText,
  getRuleDiagnosticPresentation,
  type RuleDiagnostic,
} from './rule_diagnostics';
import { useSnapshotStore } from './snapshot';

const props = withDefaults(
  defineProps<{
    show: boolean;
    layout?: DraggableCardValue;
    onUpdateShow?: (data: boolean) => void;
  }>(),
  {
    onUpdateShow: buildEmptyFn,
  },
);
const emit = defineEmits<{
  updateLayout: [value: DraggableCardValue];
}>();

const draggableInitialValue = computed(() => ({
  top: 40,
  right: Math.max(315, 12 * vw.value + 135),
  width: Math.max(480, gkdWidth.value * 0.3),
  ...props.layout,
}));
const updateLayout = (value: DraggableCardValue) => {
  emit('updateLayout', value);
};

const snapshotStore = useSnapshotStore();
const { focusNode } = snapshotStore;
const rootNode = snapshotStore.rootNode as ShallowRef<RawNode>;
const snapshot = snapshotStore.snapshot as ShallowRef<Snapshot>;

const ruleText = shallowRef('');
const diagnostic = shallowRef<RuleDiagnostic>({ status: 'empty' });
const diagnosticPresentation = computed(() =>
  getRuleDiagnosticPresentation(diagnostic.value),
);

const refreshDiagnostic = () => {
  diagnostic.value = evaluateRuleText(
    ruleText.value,
    snapshot.value,
    rootNode.value,
  );
};

const updateRuleText = (value: string) => {
  ruleText.value = value;
  refreshDiagnostic();
};
</script>

<template>
  <DraggableCard
    v-slot="{ onRef }"
    :initialValue="draggableInitialValue"
    :minWidth="300"
    sizeDraggable
    class="box-shadow-dim"
    :show="show"
    @update:value="updateLayout"
  >
    <div class="app-panel" b-1px b-solid rounded-4px p-8px>
      <div flex items-center gap-8px m-b-4px pr-4px>
        <div>规则静态诊断</div>
        <NTag size="small" :type="diagnosticPresentation.type">
          {{ diagnosticPresentation.label }}
        </NTag>
        <div :ref="onRef" flex-1 cursor-move />
        <NButton
          text
          title="重新诊断"
          :disabled="!ruleText"
          @click="refreshDiagnostic"
        >
          <template #icon>
            <SvgIcon name="refresh" />
          </template>
        </NButton>
        <NButton text title="最小化" @click="onUpdateShow(!show)">
          <template #icon>
            <SvgIcon name="minus" />
          </template>
        </NButton>
      </div>

      <NInput
        :value="ruleText"
        type="textarea"
        placeholder="粘贴单条规则、规则组、应用配置或订阅中的 apps"
        size="small"
        class="gkd_code m-b-8px"
        :autosize="{ minRows: 10, maxRows: 20 }"
        @update:value="updateRuleText"
      />

      <div v-if="diagnostic.status != 'empty'" min-h-24px>
        <NAlert
          v-if="diagnostic.status == 'invalid'"
          type="error"
          :showIcon="false"
        >
          {{ diagnostic.message }}
        </NAlert>

        <template v-else>
          <div flex items-center gap-8px flex-wrap>
            <span>{{ diagnostic.message }}</span>
            <NButton
              v-if="diagnostic.status == 'matched'"
              size="small"
              :style="getNodeStyle(diagnostic.targetNode, focusNode)"
              @click="snapshotStore.updateFocusNode(diagnostic.targetNode)"
            >
              {{ getNodeLabel(diagnostic.targetNode) }}
            </NButton>
          </div>

          <div m-t-6px text-12px color-gray-500>
            <span v-if="diagnostic.details.rulePath">
              规则位置：{{ diagnostic.details.rulePath }}；
            </span>
            <span>
              命中条件
              {{ diagnostic.details.matchedSelectors.length }} 个，未命中条件
              {{ diagnostic.details.rejectedSelectors.length }} 个
            </span>
          </div>

          <NAlert
            v-if="diagnostic.notes.length"
            type="warning"
            :showIcon="false"
            class="m-t-8px"
          >
            <div>以下条件不能由单张快照完整验证：</div>
            <div v-for="note in diagnostic.notes" :key="note">· {{ note }}</div>
          </NAlert>
        </template>
      </div>

      <div v-else text-12px color-gray-500>
        仅验证当前快照中的选择器、界面范围和排除条件，不模拟规则执行时序。
      </div>
    </div>
  </DraggableCard>
</template>
