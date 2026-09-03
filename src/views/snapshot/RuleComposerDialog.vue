<script setup lang="ts">
import { getAppInfo, getNodeLabel } from '@/domain/snapshot/node';
import { message } from '@/utils/discrete';
import { copy } from '@/utils/others';
import type { Position } from '@gkd-kit/api';
import {
  evaluateRuleText,
  getRuleDiagnosticPresentation,
} from './rule_diagnostics';
import {
  composeRuleDiagnosticText,
  composeRuleOutput,
  createRuleComposerDefaults,
  createRulePosition,
  isRulePositionAction,
  parsePreKeys,
  resolveRuleActionAfterPositionSelect,
  type PositionPoint,
  type RuleComposerOptions,
  type RuleOutputDepth,
  type RulePositionMode,
} from './rule_composer';

const props = defineProps<{
  show: boolean;
  snapshot: Snapshot;
  rootNode: RawNode;
  targetNode: RawNode;
  selector: string;
  fastQuery: boolean;
  startedAt: number;
  screenshotUrl?: string;
  exampleUrl?: string;
  snapshotUrl?: string;
}>();

const emit = defineEmits<{
  'update:show': [show: boolean];
}>();

const createInitialForm = () => {
  const defaults = createRuleComposerDefaults();
  return {
    outputDepth: 'app' as RuleOutputDepth,
    groupKey: defaults.groupKey,
    groupName: undefined as string | undefined,
    groupDescription: defaults.groupDescription,
    action: '',
    preKeysText: defaults.preKeys.join(', '),
    includeLimits: defaults.includeLimits,
    matchRoot: defaults.matchRoot,
    includeActivity: defaults.includeActivity,
    includeReferences: true,
    positionMode: 'node-relative' as RulePositionMode,
  };
};
const form = shallowReactive(createInitialForm());
const position = shallowRef<Position>();
const positionPoint = shallowRef<PositionPoint>();

const outputDepthOptions = [
  { label: '应用配置', value: 'app' },
  { label: '规则组', value: 'group' },
  { label: '单条规则', value: 'rule' },
  { label: 'TypeScript 文件', value: 'ts' },
];
const actionOptions = [
  { label: '使用默认动作', value: '' },
  { label: 'click', value: 'click' },
  { label: 'clickNode', value: 'clickNode' },
  { label: 'clickCenter', value: 'clickCenter' },
  { label: 'back', value: 'back' },
  { label: 'longClick', value: 'longClick' },
  { label: 'longClickNode', value: 'longClickNode' },
  { label: 'longClickCenter', value: 'longClickCenter' },
  { label: 'none', value: 'none' },
];
const positionModeOptions = [
  { label: '节点相对比例', value: 'node-relative' },
  { label: '节点相对像素', value: 'node-pixel' },
  { label: '屏幕绝对坐标', value: 'screen' },
];

const preKeysResult = computed(() => parsePreKeys(form.preKeysText));
const defaultGroupName = computed(
  () => createRuleComposerDefaults(props.startedAt).groupName,
);
const groupName = computed(() => form.groupName ?? defaultGroupName.value);
const composerOptions = computed<RuleComposerOptions>(() => ({
  outputDepth: form.outputDepth,
  appId: props.snapshot.appId,
  appName: getAppInfo(props.snapshot).name,
  activityId: props.snapshot.activityId,
  selector: props.selector,
  fastQuery: props.fastQuery,
  groupKey: form.groupKey,
  groupName: groupName.value.trim(),
  groupDescription: form.groupDescription.trim(),
  action: form.action || undefined,
  preKeys: preKeysResult.value.values,
  includeLimits: form.includeLimits,
  matchRoot: form.matchRoot,
  includeActivity: form.includeActivity,
  exampleUrl: form.includeReferences ? props.exampleUrl : undefined,
  snapshotUrl: form.includeReferences ? props.snapshotUrl : undefined,
  position: position.value,
}));
const output = computed(() => composeRuleOutput(composerOptions.value));
const diagnostic = computed(() =>
  evaluateRuleText(
    composeRuleDiagnosticText(composerOptions.value),
    props.snapshot,
    props.rootNode,
  ),
);
const diagnosticPresentation = computed(() =>
  getRuleDiagnosticPresentation(diagnostic.value),
);
const positionText = computed(() =>
  position.value ? JSON.stringify(position.value) : '点击截图选择动作位置',
);
const markerStyle = computed(() => {
  const point = positionPoint.value;
  if (!point) return { display: 'none' };
  return {
    left: `${(point.x / props.snapshot.screenWidth) * 100}%`,
    top: `${(point.y / props.snapshot.screenHeight) * 100}%`,
    transform: 'translate(-50%, -50%)',
  };
});

const updateOutputDepth = (value: RuleOutputDepth) => {
  form.outputDepth = value;
};
const updateGroupKey = (value: number | null) => {
  if (value != null && Number.isSafeInteger(value)) form.groupKey = value;
};
const updateGroupName = (value: string) => {
  form.groupName = value;
};
const updateGroupDescription = (value: string) => {
  form.groupDescription = value;
};
const updateAction = (value: string) => {
  form.action = value;
  if (position.value && !isRulePositionAction(value)) {
    clearPosition();
    message.info('当前动作不支持自定义点击位置，已清除位置');
  }
};
const updatePreKeys = (value: string) => {
  form.preKeysText = value;
};
const updateIncludeLimits = (value: boolean) => {
  form.includeLimits = value;
};
const updateMatchRoot = (value: boolean) => {
  form.matchRoot = value;
};
const updateIncludeActivity = (value: boolean) => {
  form.includeActivity = value;
};
const updateIncludeReferences = (value: boolean) => {
  form.includeReferences = value;
};
const getTargetRect = () => ({
  left: props.targetNode.attr.left,
  top: props.targetNode.attr.top,
  width: props.targetNode.attr.width,
  height: props.targetNode.attr.height,
});
const updatePosition = () => {
  if (!positionPoint.value) return;
  try {
    position.value = createRulePosition(
      positionPoint.value,
      getTargetRect(),
      form.positionMode,
    );
    form.action = resolveRuleActionAfterPositionSelect(form.action);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
};
const updatePositionMode = (value: RulePositionMode) => {
  form.positionMode = value;
  updatePosition();
};
const selectPosition = (event: MouseEvent) => {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement)) return;
  const rect = image.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return;
  positionPoint.value = {
    x: Math.max(
      0,
      Math.min(
        props.snapshot.screenWidth,
        ((event.clientX - rect.left) / rect.width) * props.snapshot.screenWidth,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        props.snapshot.screenHeight,
        ((event.clientY - rect.top) / rect.height) *
          props.snapshot.screenHeight,
      ),
    ),
  };
  updatePosition();
};
const clearPosition = () => {
  position.value = undefined;
  positionPoint.value = undefined;
};
const copyOutput = async () => {
  if (preKeysResult.value.error) {
    message.error(preKeysResult.value.error);
    return;
  }
  if (!groupName.value.trim()) {
    message.error('规则组名称不能为空');
    return;
  }
  await copy(output.value);
};
const updateVisible = (visible: boolean) => {
  emit('update:show', visible);
};
const resetDialogState = () => {
  Object.assign(form, createInitialForm());
  position.value = undefined;
  positionPoint.value = undefined;
};
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="规则编排器"
    class="w-1080px max-w-[calc(100vw-48px)]"
    style="max-height: calc(100vh - 48px)"
    :maskClosable="false"
    @update:show="updateVisible"
    @afterLeave="resetDialogState"
  >
    <div class="grid grid-cols-3 gap-x-12px gap-y-4px">
      <NFormItem label="输出层级">
        <NSelect
          :value="form.outputDepth"
          :options="outputDepthOptions"
          @update:value="updateOutputDepth"
        />
      </NFormItem>
      <NFormItem label="规则组 key">
        <NInputNumber
          :value="form.groupKey"
          class="w-full"
          @update:value="updateGroupKey"
        />
      </NFormItem>
      <NFormItem label="动作">
        <NSelect
          :value="form.action"
          :options="actionOptions"
          @update:value="updateAction"
        />
      </NFormItem>
      <NFormItem label="规则组名称" class="col-span-2">
        <NInput :value="groupName" @update:value="updateGroupName" />
      </NFormItem>
      <NFormItem
        label="preKeys"
        :validationStatus="preKeysResult.error ? 'error' : undefined"
        :feedback="preKeysResult.error"
      >
        <NInput
          :value="form.preKeysText"
          placeholder="例如：1, 2"
          @update:value="updatePreKeys"
        />
      </NFormItem>
      <NFormItem label="规则组描述" class="col-span-3">
        <NInput
          :value="form.groupDescription"
          @update:value="updateGroupDescription"
        />
      </NFormItem>
    </div>

    <div class="flex flex-wrap items-center gap-x-20px gap-y-8px">
      <NSwitch
        :value="form.includeActivity"
        @update:value="updateIncludeActivity"
      >
        <template #checked>限制当前界面</template>
        <template #unchecked>不限界面</template>
      </NSwitch>
      <NSwitch :value="form.matchRoot" @update:value="updateMatchRoot">
        <template #checked>包含 matchRoot</template>
        <template #unchecked>不含 matchRoot</template>
      </NSwitch>
      <NSwitch :value="form.includeLimits" @update:value="updateIncludeLimits">
        <template #checked>包含执行限制</template>
        <template #unchecked>不含执行限制</template>
      </NSwitch>
      <NSwitch
        v-if="exampleUrl || snapshotUrl"
        :value="form.includeReferences"
        @update:value="updateIncludeReferences"
      >
        <template #checked>包含快照链接</template>
        <template #unchecked>不含快照链接</template>
      </NSwitch>
    </div>

    <div class="app-divider" />

    <div
      class="grid grid-cols-[minmax(320px,0.9fr)_minmax(380px,1.1fr)] gap-12px"
    >
      <div class="min-w-0">
        <div class="mb-6px flex items-center gap-8px">
          <span class="font-600">点击位置</span>
          <NTag size="small">目标：{{ getNodeLabel(targetNode) }}</NTag>
          <NButton
            v-if="position"
            class="ml-auto"
            size="tiny"
            @click="clearPosition"
          >
            清除
          </NButton>
        </div>
        <NSelect
          :value="form.positionMode"
          :options="positionModeOptions"
          class="mb-8px"
          @update:value="updatePositionMode"
        />
        <div
          v-if="screenshotUrl"
          class="relative inline-flex max-h-340px max-w-full overflow-hidden rounded-4px bg-[#111827]"
        >
          <img
            :src="screenshotUrl"
            class="block max-h-340px max-w-full cursor-crosshair object-contain"
            @click="selectPosition"
          />
          <span
            class="pointer-events-none absolute size-14px rounded-full border-2 border-white bg-[#d03050] shadow"
            :style="markerStyle"
          />
        </div>
        <div class="mt-6px break-all gkd_code text-12px text-[#64748b]">
          {{ positionText }}
        </div>
      </div>

      <div class="min-w-0">
        <div class="mb-6px flex items-center gap-8px">
          <span class="font-600">生成结果</span>
          <NTag size="small" :type="diagnosticPresentation.type">
            {{ diagnosticPresentation.label }}
          </NTag>
        </div>
        <NInput
          :value="output"
          type="textarea"
          readonly
          :resizable="false"
          class="h-340px gkd_code"
        />
        <NAlert
          v-if="diagnostic.status != 'empty'"
          class="mt-8px"
          :type="diagnosticPresentation.type"
          :showIcon="false"
        >
          <div>{{ diagnostic.message }}</div>
          <div
            v-for="note in diagnostic.status == 'matched' ||
            diagnostic.status == 'not-matched'
              ? diagnostic.notes
              : []"
            :key="note"
            class="text-12px"
          >
            · {{ note }}
          </div>
        </NAlert>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-8px">
        <NButton @click="updateVisible(false)">关闭</NButton>
        <NButton
          type="primary"
          :disabled="Boolean(preKeysResult.error) || !groupName.trim()"
          @click="copyOutput"
        >
          复制结果
        </NButton>
      </div>
    </template>
  </NModal>
</template>
