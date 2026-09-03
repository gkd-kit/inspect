<script setup lang="ts">
import {
  getSelectorErrorHighlightSegments,
  inspectSelectorSyntax,
  type SelectorSyntaxDiagnostic,
} from '@/entities/selector/diagnostics';

const props = withDefaults(
  defineProps<{
    value: string;
    placeholder?: string;
    validate?: boolean;
    autosize?: { minRows?: number; maxRows?: number };
    hint?: string;
  }>(),
  {
    placeholder: '请输入选择器',
    validate: true,
    autosize: () => ({ minRows: 1, maxRows: 10 }),
    hint: '',
  },
);

const emit = defineEmits<{
  'update:value': [value: string];
  keydown: [event: KeyboardEvent];
}>();

const rootRef = shallowRef<HTMLElement>();
const highlightViewportStyle = shallowRef<Record<string, string>>({});
const highlightContentStyle = shallowRef<Record<string, string>>({});
const diagnostic = computed<SelectorSyntaxDiagnostic>(() =>
  props.validate ? inspectSelectorSyntax(props.value) : { status: 'empty' },
);
const highlightSegments = computed(() =>
  getSelectorErrorHighlightSegments(props.value, diagnostic.value),
);
const feedbackText = computed(() => {
  const result = diagnostic.value;
  if (result.status == 'valid') return '语法正确';
  if (result.status == 'empty') return props.hint;
  const position = result.index == null ? '' : ` · 位置 ${result.index + 1}`;
  return `语法错误${position}：${result.message}`;
});

let textarea: HTMLTextAreaElement | undefined;
let resizeObserver: ResizeObserver | undefined;

const syncHighlightLayout = () => {
  const root = rootRef.value;
  if (!root || !textarea) return;

  const rootRect = root.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  const style = getComputedStyle(textarea);
  highlightViewportStyle.value = {
    top: `${textareaRect.top - rootRect.top}px`,
    left: `${textareaRect.left - rootRect.left}px`,
    width: `${textareaRect.width}px`,
    height: `${textareaRect.height}px`,
  };
  highlightContentStyle.value = {
    boxSizing: style.boxSizing,
    width: `${textarea.clientWidth}px`,
    minHeight: `${textarea.scrollHeight}px`,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    textIndent: style.textIndent,
    textTransform: style.textTransform,
    whiteSpace: style.whiteSpace,
    wordBreak: style.wordBreak,
    overflowWrap: style.overflowWrap,
    tabSize: style.tabSize,
    transform: `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`,
  };
};

const scheduleHighlightLayoutSync = () => {
  void nextTick(syncHighlightLayout);
};
const updateValue = (value: string) => {
  emit('update:value', value);
  scheduleHighlightLayoutSync();
};
const handleScroll = () => {
  syncHighlightLayout();
};

onMounted(() => {
  textarea = rootRef.value?.querySelector('textarea') ?? undefined;
  if (!textarea) return;
  textarea.addEventListener('scroll', handleScroll, { passive: true });
  resizeObserver = new ResizeObserver(syncHighlightLayout);
  resizeObserver.observe(rootRef.value!);
  resizeObserver.observe(textarea);
  syncHighlightLayout();
});

onBeforeUnmount(() => {
  textarea?.removeEventListener('scroll', handleScroll);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    class="selector-syntax-field app-panel w-full overflow-hidden rounded-6px border transition-colors duration-200 focus-within:border-[#18a058]"
    :class="{
      'selector-syntax-field--invalid': diagnostic.status == 'invalid',
    }"
  >
    <div ref="rootRef" class="selector-syntax-input relative">
      <NInput
        :value="value"
        class="gkd_code"
        type="textarea"
        :placeholder="placeholder"
        :autosize="autosize"
        :bordered="false"
        @update:value="updateValue"
        @keydown="emit('keydown', $event)"
      />
      <div
        v-if="highlightSegments"
        aria-hidden="true"
        class="selector-error-highlight pointer-events-none absolute z-1 overflow-hidden"
        :style="highlightViewportStyle"
      >
        <div
          class="selector-error-highlight__content text-transparent"
          :style="highlightContentStyle"
        >
          <span>{{ highlightSegments.before }}</span
          ><span
            class="selector-error-highlight__char"
            :class="{
              'selector-error-highlight__char--eof': highlightSegments.eof,
            }"
            >{{ highlightSegments.error }}</span
          ><span>{{ highlightSegments.after }}</span>
        </div>
      </div>
    </div>
    <div
      class="min-h-24px flex items-center justify-between gap-6px px-8px pb-5px"
    >
      <span
        v-if="diagnostic.status == 'invalid'"
        role="alert"
        class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-11px leading-22px text-[#d03050]"
        :title="feedbackText"
      >
        {{ feedbackText }}
      </span>
      <span
        v-else-if="diagnostic.status == 'valid'"
        class="select-none text-11px leading-22px text-[#18a058]"
      >
        {{ feedbackText }}
      </span>
      <span
        v-else
        class="select-none text-11px leading-22px"
        style="color: var(--app-muted)"
      >
        {{ feedbackText }}
      </span>
      <slot name="actions" :diagnostic="diagnostic" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.selector-syntax-field--invalid,
.selector-syntax-field--invalid:focus-within {
  border-color: #d03050 !important;
}

.selector-error-highlight__content {
  transform-origin: left top;
}

.selector-error-highlight__char {
  border-radius: 2px;
  background: rgba(208, 48, 80, 0.24);
  box-shadow: inset 0 -1px rgba(208, 48, 80, 0.8);
}

.selector-error-highlight__char--eof {
  display: inline-block;
  width: 2px;
  height: 1.25em;
  border-radius: 1px;
  background: rgba(208, 48, 80, 0.82);
  box-shadow: none;
  vertical-align: -0.22em;
}

:global(:root[data-theme='dark']) .selector-error-highlight__char {
  background: rgba(255, 99, 125, 0.3);
  box-shadow: inset 0 -1px rgba(255, 125, 146, 0.92);
}

:global(:root[data-theme='dark']) .selector-error-highlight__char--eof {
  background: rgba(255, 125, 146, 0.92);
  box-shadow: none;
}
</style>
