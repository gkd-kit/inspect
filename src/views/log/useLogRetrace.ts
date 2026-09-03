import { message } from '@/utils/discrete';
import type { ShallowRef } from 'vue';
import type { CrashDetail } from './crash_preview';
import { LazyBuildRetracer } from './retrace_client';
import { hasRetraceableStack } from './retrace_text';

export type StackRetraceTextState = {
  originalText: string;
  retracedText?: string;
  available: boolean;
  loading: boolean;
  active: boolean;
  autoAttempted: boolean;
};

interface LogRetraceOptions {
  buildKey: ShallowRef<string | undefined>;
  crashDetail: ShallowRef<CrashDetail | undefined>;
  logDetailText: ShallowRef<string | undefined>;
  previewText: ShallowRef<string>;
}

export const useLogRetrace = (options: LogRetraceOptions) => {
  const previewRetraceState = shallowRef<StackRetraceTextState>();
  const crashRetraceState = shallowRef<StackRetraceTextState>();
  const logRetraceState = shallowRef<StackRetraceTextState>();
  const retraceTextStates = new Map<string, StackRetraceTextState>();
  let buildRetracer: LazyBuildRetracer | undefined;

  const resetBuildRetrace = () => {
    buildRetracer?.dispose();
    buildRetracer = undefined;
    options.buildKey.value = undefined;
    retraceTextStates.clear();
    previewRetraceState.value = undefined;
    crashRetraceState.value = undefined;
    logRetraceState.value = undefined;
  };

  const getRetraceTextState = (key: string, originalText: string) => {
    const previous = retraceTextStates.get(key);
    if (previous?.originalText == originalText) return previous;
    const state = reactive<StackRetraceTextState>({
      originalText,
      available: hasRetraceableStack(originalText),
      loading: false,
      active: false,
      autoAttempted: false,
    });
    retraceTextStates.set(key, state);
    return state;
  };

  const getRetraceStateText = (state: StackRetraceTextState) =>
    state.active && state.retracedText != null
      ? state.retracedText
      : state.originalText;

  const toggleRetraceText = async (
    state: StackRetraceTextState | undefined,
    kind: `crash` | `log`,
    isCurrent: () => boolean,
    applyText: (text: string) => void,
  ) => {
    const buildKey = options.buildKey.value;
    if (!state || !state.available || !buildKey || state.loading) return;
    if (state.active) {
      state.active = false;
      applyText(state.originalText);
      return;
    }
    if (state.retracedText != null) {
      state.active = true;
      applyText(state.retracedText);
      return;
    }
    const retracer = (buildRetracer ||= new LazyBuildRetracer(buildKey));
    state.loading = true;
    try {
      const result = await retracer.retrace(state.originalText, kind);
      if (result == state.originalText) {
        if (isCurrent()) message.warning(`没有找到与当前 mapping 匹配的堆栈`);
        return;
      }
      state.retracedText = result;
      state.active = true;
      if (isCurrent()) applyText(result);
    } catch (error) {
      if (error instanceof DOMException && error.name == `AbortError`) return;
      if (!isCurrent()) return;
      message.error(
        `堆栈还原失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      state.loading = false;
    }
  };

  const autoRetraceText = (
    state: StackRetraceTextState | undefined,
    kind: `crash` | `log`,
    isCurrent: () => boolean,
    applyText: (text: string) => void,
  ) => {
    if (!state?.available || state.autoAttempted) return;
    state.autoAttempted = true;
    void toggleRetraceText(state, kind, isCurrent, applyText);
  };

  const togglePreviewRetrace = () => {
    const state = previewRetraceState.value;
    void toggleRetraceText(
      state,
      `log`,
      () => previewRetraceState.value == state,
      (text) => {
        if (previewRetraceState.value == state)
          options.previewText.value = text;
      },
    );
  };

  const toggleCrashRetrace = () => {
    const state = crashRetraceState.value;
    void toggleRetraceText(
      state,
      `crash`,
      () => crashRetraceState.value == state,
      (stackTrace) => {
        if (crashRetraceState.value != state || !options.crashDetail.value) {
          return;
        }
        options.crashDetail.value = markRaw({
          ...options.crashDetail.value,
          stackTrace,
        });
      },
    );
  };

  const toggleLogRetrace = () => {
    const state = logRetraceState.value;
    void toggleRetraceText(
      state,
      `log`,
      () => logRetraceState.value == state,
      (text) => {
        if (logRetraceState.value == state) options.logDetailText.value = text;
      },
    );
  };

  return {
    autoRetraceText,
    crashRetraceState,
    getRetraceStateText,
    getRetraceTextState,
    logRetraceState,
    previewRetraceState,
    resetBuildRetrace,
    toggleCrashRetrace,
    toggleLogRetrace,
    togglePreviewRetrace,
  };
};
