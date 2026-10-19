import { useKeyedTask } from '@/shared/lib/latest_task';
import { computed, markRaw, reactive, shallowRef } from 'vue';
import { message } from '@/shared/services/feedback';
import type { ShallowRef } from 'vue';
import type { CrashDetail } from './crash_preview';
import { LazyBuildRetracer } from './retrace_client';
import { hasRetraceableStack } from './retrace_text';

export type StackRetraceTextState = {
  originalText: string;
  retracedText?: string;
  available: boolean;
  loading: boolean;
  stage?: string;
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
  const stateKeys = new WeakMap<StackRetraceTextState, string>();
  const retraceTextStates = new Map<string, StackRetraceTextState>();
  let buildRetracer: LazyBuildRetracer | undefined;

  const resetBuildRetrace = () => {
    retraceTask.cancelAll();
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
    if (previous) retraceTask.cancel(key);
    const state = reactive<StackRetraceTextState>({
      originalText,
      available: hasRetraceableStack(originalText),
      get loading() {
        return Boolean(retraceTask.loading.value[key]);
      },
      get stage() {
        return retraceTask.progress.value[key]?.stage;
      },
      active: false,
      autoAttempted: false,
    });
    stateKeys.set(state, key);
    retraceTextStates.set(key, state);
    return state;
  };

  const getCachedRetraceTextState = (key: string) => retraceTextStates.get(key);

  const getRetraceStateText = (state: StackRetraceTextState) =>
    state.active && state.retracedText != null
      ? state.retracedText
      : state.originalText;

  const retraceTask = useKeyedTask(
    async (
      { commit, isCurrent: taskCurrent, reportProgress },
      _key: string,
      state: StackRetraceTextState,
      kind: 'crash' | 'log',
      isCurrent: () => boolean,
      applyText: (text: string) => void,
    ) => {
      const buildKey = options.buildKey.value;
      if (!state.available || !buildKey) return;
      try {
        const active = !state.active;
        const text = !active
          ? state.originalText
          : (state.retracedText ??
            (await (buildRetracer ||= new LazyBuildRetracer(buildKey)).retrace(
              state.originalText,
              kind,
              (stage) => {
                if (isCurrent()) reportProgress({ stage });
              },
            )));
        if (!taskCurrent() || !isCurrent()) return;
        if (active && text === state.originalText) {
          message.warning('没有找到与当前 mapping 匹配的堆栈');
          return;
        }
        commit(() => {
          if (active) state.retracedText = text;
          state.active = active;
          applyText(text);
        });
      } catch (error) {
        if (
          taskCurrent() &&
          isCurrent() &&
          !(error instanceof DOMException && error.name === 'AbortError')
        )
          message.error(
            '堆栈还原失败: ' +
              (error instanceof Error ? error.message : String(error)),
          );
        throw error;
      }
    },
  );
  const toggleRetraceText = (
    state: StackRetraceTextState | undefined,
    kind: 'crash' | 'log',
    isCurrent: () => boolean,
    applyText: (text: string) => void,
  ) => {
    if (!state) return;
    const key = stateKeys.get(state);
    if (key !== undefined)
      return retraceTask.run(key, state, kind, isCurrent, applyText);
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
        if (!options.crashDetail.value) {
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
        options.logDetailText.value = text;
      },
    );
  };

  return {
    autoRetraceText,
    crashRetraceState: computed(() => crashRetraceState.value),
    setCrashRetraceState: (state: StackRetraceTextState | undefined) => {
      crashRetraceState.value = state;
    },
    getRetraceStateText,
    getRetraceTextState,
    getCachedRetraceTextState,
    logRetraceState: computed(() => logRetraceState.value),
    setLogRetraceState: (state: StackRetraceTextState | undefined) => {
      logRetraceState.value = state;
    },
    previewRetraceState: computed(() => previewRetraceState.value),
    setPreviewRetraceState: (state: StackRetraceTextState | undefined) => {
      previewRetraceState.value = state;
    },
    resetBuildRetrace,
    toggleCrashRetrace,
    toggleLogRetrace,
    togglePreviewRetrace,
  };
};
