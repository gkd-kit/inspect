<script setup lang="ts">
import {
  NButton,
  NButtonGroup,
  NCheckbox,
  NModal,
  NSpin,
  NTooltip,
} from 'naive-ui';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import { useLatestTask } from '@/shared/lib/latest_task';
import GkSvg from '@/shared/ui/GkSvg.vue';
import { message } from '@/shared/services/feedback';
import type { RedactionRect, RedactionSelection } from './privacy_redaction';
import { getOffscreenTextNodes, hasSensitiveText } from './privacy_redaction';
import type { RawNode } from '@/entities/snapshot/types';
import {
  commitRedactionRectangles,
  createRedactionHistory,
  getRedactionHistoryCommand,
  redoRedactionHistory,
  undoRedactionHistory,
} from './redaction_history';

const props = defineProps<{
  show: boolean;
  sourceUrl: string;
  imageWidth: number;
  imageHeight: number;
  nodes: RawNode[];
}>();

const emit = defineEmits<{
  apply: [selection: RedactionSelection];
  'update:show': [show: boolean];
}>();

const canvasRef = shallowRef<HTMLCanvasElement>();
const sourceImage = shallowRef<HTMLImageElement>();
const redactionHistory = shallowRef(createRedactionHistory());
const rectangles = computed(() => redactionHistory.value.rectangles);
const canUndo = computed(() => redactionHistory.value.undoStack.length > 0);
const canRedo = computed(() => redactionHistory.value.redoStack.length > 0);
const draftRect = shallowRef<RedactionRect>();
const selectedNodeIds = shallowRef<number[]>([]);
const offscreenNodes = computed(() =>
  getOffscreenTextNodes(props.nodes, props.imageWidth, props.imageHeight),
);
const hasSelection = computed(
  () => rectangles.value.length > 0 || selectedNodeIds.value.length > 0,
);
const setNodeSelected = (id: number, checked: boolean) => {
  selectedNodeIds.value = checked
    ? [...new Set([...selectedNodeIds.value, id])]
    : selectedNodeIds.value.filter((value) => value !== id);
};
const setAllNodesSelected = (checked: boolean) => {
  selectedNodeIds.value = checked
    ? offscreenNodes.value.map((node) => node.id)
    : [];
};
let pointerId: number | undefined;

const drawCanvas = () => {
  const canvas = canvasRef.value;
  const image = sourceImage.value;
  if (!canvas || !image) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(0, 0, 0, 0.78)';
  context.strokeStyle = '#d03050';
  context.lineWidth = Math.max(2, canvas.width / 500);
  for (const rect of [
    ...rectangles.value,
    ...(draftRect.value ? [draftRect.value] : []),
  ]) {
    const left = Math.min(rect.left, rect.right);
    const top = Math.min(rect.top, rect.bottom);
    const width = Math.abs(rect.right - rect.left);
    const height = Math.abs(rect.bottom - rect.top);
    context.fillRect(left, top, width, height);
    context.strokeRect(left, top, width, height);
  }
};

const sourceTask = useLatestTask(async ({ commit }) => {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('截图加载失败'));
    image.src = props.sourceUrl;
  });
  commit(() => {
    redactionHistory.value = createRedactionHistory();
    selectedNodeIds.value = [];
    sourceImage.value = image;
    draftRect.value = undefined;
    drawCanvas();
  });
});
const loading = sourceTask.loading;
const loadSourceImage = async () => {
  const result = await sourceTask.run();
  if (result.status === 'error') message.error(result.error.message);
};
onBeforeUnmount(sourceTask.cancel);

const commitRectangles = (value: RedactionRect[]) => {
  redactionHistory.value = commitRedactionRectangles(
    redactionHistory.value,
    value,
  );
};

const getNaturalPosition = (event: PointerEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * canvas.width) / bounds.width,
    y: ((event.clientY - bounds.top) * canvas.height) / bounds.height,
  };
};

const startRectangle = (event: PointerEvent) => {
  const position = getNaturalPosition(event);
  if (!position || !canvasRef.value) return;
  pointerId = event.pointerId;
  canvasRef.value.setPointerCapture(event.pointerId);
  draftRect.value = {
    left: position.x,
    top: position.y,
    right: position.x,
    bottom: position.y,
  };
  drawCanvas();
};

const moveRectangle = (event: PointerEvent) => {
  if (pointerId != event.pointerId || !draftRect.value) return;
  const position = getNaturalPosition(event);
  if (!position) return;
  draftRect.value = {
    ...draftRect.value,
    right: position.x,
    bottom: position.y,
  };
  drawCanvas();
};

const finishRectangle = (event: PointerEvent) => {
  if (pointerId != event.pointerId || !draftRect.value) return;
  const rect = draftRect.value;
  if (
    Math.abs(rect.right - rect.left) >= 2 &&
    Math.abs(rect.bottom - rect.top) >= 2
  ) {
    commitRectangles([...rectangles.value, rect]);
  }
  draftRect.value = undefined;
  pointerId = undefined;
  drawCanvas();
};

const undoRectangles = () => {
  redactionHistory.value = undoRedactionHistory(redactionHistory.value);
  drawCanvas();
};

const redoRectangles = () => {
  redactionHistory.value = redoRedactionHistory(redactionHistory.value);
  drawCanvas();
};

const clearRectangles = () => {
  if (!rectangles.value.length) return;
  commitRectangles([]);
  draftRect.value = undefined;
  drawCanvas();
};

const handleHistoryShortcut = (event: KeyboardEvent) => {
  const command = getRedactionHistoryCommand(event);
  if (!command) return;
  event.preventDefault();
  if (command == 'undo') {
    undoRectangles();
  } else {
    redoRectangles();
  }
};

const activateDialog = () => {
  window.removeEventListener('keydown', handleHistoryShortcut);
  window.addEventListener('keydown', handleHistoryShortcut);
  void loadSourceImage();
};

const deactivateDialog = () => {
  sourceTask.cancel();
  window.removeEventListener('keydown', handleHistoryShortcut);
};

onBeforeUnmount(deactivateDialog);

const applyRedaction = () => {
  const image = sourceImage.value;
  const canvas = canvasRef.value;
  if (!hasSelection.value || loading.value || !canvas) return;
  if (rectangles.value.length && !image) return;
  emit('apply', {
    imageHeight: canvas.height,
    imageWidth: canvas.width,
    rectangles: rectangles.value,
    nodeIds: selectedNodeIds.value,
  });
};
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="创建脱敏副本"
    class="max-w-[calc(100vw-48px)]"
    style="width: fit-content"
    :maskClosable="false"
    @afterEnter="activateDialog"
    @afterLeave="deactivateDialog"
    @update:show="emit('update:show', $event)"
  >
    <div class="mb-[8px] text-[13px] text-[#64748b]">
      拖动框选敏感区域，截图将被涂黑，相交节点的文本将替换为等长星号。
    </div>
    <div
      class="flex max-h-[calc(100vh-240px)] flex-wrap gap-[16px] overflow-auto"
    >
      <NSpin :show="loading">
        <div class="flex justify-center overflow-auto bg-[#111827]">
          <canvas
            ref="canvasRef"
            :width="imageWidth"
            :height="imageHeight"
            class="block max-h-[calc(100vh-260px)] max-w-[calc(100vw-96px)] cursor-crosshair touch-none object-contain"
            @pointerdown="startRectangle"
            @pointermove="moveRectangle"
            @pointerup="finishRectangle"
            @pointercancel="finishRectangle"
          />
        </div>
      </NSpin>
      <div
        class="flex h-[calc(100vh-260px)] w-[320px] max-w-full min-w-0 flex-col overflow-hidden"
      >
        <div class="mb-[8px] shrink-0 font-medium">屏幕外节点</div>
        <div class="mb-[12px] shrink-0 text-[12px] text-[#64748b]">
          勾选要脱敏的节点，文本将替换为等长星号。
        </div>
        <NCheckbox
          v-if="offscreenNodes.length"
          class="shrink-0"
          :checked="selectedNodeIds.length === offscreenNodes.length"
          :indeterminate="
            selectedNodeIds.length > 0 &&
            selectedNodeIds.length < offscreenNodes.length
          "
          @update:checked="setAllNodesSelected"
          >全选（{{ selectedNodeIds.length }}/{{
            offscreenNodes.length
          }}）</NCheckbox
        >
        <div v-else class="text-[13px] text-[#64748b]">
          没有需要脱敏的屏幕外节点
        </div>
        <div class="mt-[8px] min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div class="flex flex-col gap-[12px]">
            <NCheckbox
              v-for="node in offscreenNodes"
              :key="node.id"
              :checked="selectedNodeIds.includes(node.id)"
              @update:checked="setNodeSelected(node.id, $event)"
            >
              <div class="break-all whitespace-pre-wrap">
                <div class="text-[12px] text-[#64748b]">
                  #{{ node.id }} · {{ node.attr.name.split('.').at(-1) }}
                </div>
                <div v-if="hasSensitiveText(node.attr.text)">
                  text：{{ node.attr.text }}
                </div>
                <div v-if="hasSensitiveText(node.attr.desc)">
                  desc：{{ node.attr.desc }}
                </div>
              </div>
            </NCheckbox>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center gap-[8px]">
        <span class="mr-auto text-[12px] text-[#64748b]">
          已选择 {{ rectangles.length }} 个区域、{{ selectedNodeIds.length }}
          个节点
        </span>
        <NButtonGroup>
          <NButton
            :disabled="!canUndo"
            title="撤销（Ctrl/⌘+Z）"
            aria-label="撤销"
            @click="undoRectangles"
          >
            <template #icon>
              <GkSvg name="undo" />
            </template>
          </NButton>
          <NButton
            :disabled="!canRedo"
            title="恢复（Ctrl+Y / Ctrl/⌘+Shift+Z）"
            aria-label="恢复"
            @click="redoRectangles"
          >
            <template #icon>
              <GkSvg name="redo" />
            </template>
          </NButton>
        </NButtonGroup>
        <NTooltip>
          <template #trigger>
            <NButton
              quaternary
              class="clear-selection-button"
              :disabled="!rectangles.length"
              aria-label="清除全部区域"
              @click="clearRectangles"
            >
              <template #icon>
                <GkSvg name="clear-selection" />
              </template>
            </NButton>
          </template>
          清除全部区域（可撤销）
        </NTooltip>
        <NButton
          type="primary"
          :disabled="!hasSelection || loading"
          @click="applyRedaction"
        >
          创建副本
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.clear-selection-button:not(.n-button--disabled) {
  --n-text-color-hover: #d03050 !important;
  --n-text-color-focus: #d03050 !important;
  --n-text-color-pressed: #ab1f3f !important;
  --n-ripple-color: #d03050 !important;
}
</style>
