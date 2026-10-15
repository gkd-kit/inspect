<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import { message } from '@/shared/services/feedback';
import type { RedactionRect, RedactionSelection } from './privacy_redaction';
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
const loading = shallowRef(false);
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

const loadSourceImage = async () => {
  loading.value = true;
  redactionHistory.value = createRedactionHistory();
  draftRect.value = undefined;
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('截图加载失败'));
      image.src = props.sourceUrl;
    });
    sourceImage.value = image;
    const canvas = canvasRef.value;
    if (!canvas) return;
    drawCanvas();
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
};

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
  window.removeEventListener('keydown', handleHistoryShortcut);
};

onBeforeUnmount(deactivateDialog);

const applyRedaction = () => {
  const image = sourceImage.value;
  const canvas = canvasRef.value;
  if (!rectangles.value.length || !image || !canvas) return;
  emit('apply', {
    imageHeight: canvas.height,
    imageWidth: canvas.width,
    rectangles: rectangles.value,
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
    <div class="mb-8px text-13px text-[#64748b]">
      在截图上拖动框选敏感区域。副本会用纯黑色覆盖图片，并将相交节点的
      text、desc 替换为 ***。
    </div>
    <NSpin :show="loading">
      <div
        class="flex max-h-[calc(100vh-210px)] justify-center overflow-auto bg-[#111827]"
      >
        <canvas
          ref="canvasRef"
          :width="imageWidth"
          :height="imageHeight"
          class="block max-h-[calc(100vh-220px)] max-w-[calc(100vw-96px)] cursor-crosshair touch-none object-contain"
          @pointerdown="startRectangle"
          @pointermove="moveRectangle"
          @pointerup="finishRectangle"
          @pointercancel="finishRectangle"
        />
      </div>
    </NSpin>
    <template #footer>
      <div class="flex items-center gap-8px">
        <span class="mr-auto text-12px text-[#64748b]">
          已选择 {{ rectangles.length }} 个区域；原始快照不会被修改
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
          :disabled="!rectangles.length || loading"
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
