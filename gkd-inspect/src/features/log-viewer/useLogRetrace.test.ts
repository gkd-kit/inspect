import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import { shallowRef } from 'vue';
import type { CrashDetail } from './crash_preview';
const mocks = vi.hoisted(() => ({
  retrace: vi.fn(),
  dispose: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('./retrace_client', () => ({
  LazyBuildRetracer: class {
    retrace = mocks.retrace;
    dispose = mocks.dispose;
  },
}));
vi.mock('./retrace_text', () => ({
  hasRetraceableStack: (text: string) => text.startsWith('stack'),
}));
vi.mock('@/shared/services/feedback', () => ({
  message: { error: mocks.error, warning: mocks.warning },
}));
import { useLogRetrace } from './useLogRetrace';
beforeEach(() => {
  vi.clearAllMocks();
});
const createRetrace = () =>
  useLogRetrace({
    buildKey: shallowRef('build'),
    crashDetail: shallowRef<CrashDetail>(),
    logDetailText: shallowRef<string>(),
    previewText: shallowRef(''),
  });

test('retrace stages are isolated and cancelled tasks cannot publish progress', async () => {
  const pending = Promise.withResolvers<string>();
  const reporters = new Map<string, (stage: string) => void>();
  mocks.retrace.mockImplementation(
    (text: string, _kind: string, report: (stage: string) => void) => {
      reporters.set(text, report);
      report('正在加载引擎');
      return pending.promise;
    },
  );
  const retrace = createRetrace();
  const a = retrace.getRetraceTextState('a', 'stack A');
  const b = retrace.getRetraceTextState('b', 'stack B');
  retrace.autoRetraceText(a, 'log', () => true, vi.fn());
  retrace.autoRetraceText(b, 'log', () => true, vi.fn());
  reporters.get('stack A')!('正在还原堆栈');
  assert.equal(a.stage, '正在还原堆栈');
  assert.equal(b.stage, '正在加载引擎');
  retrace.resetBuildRetrace();
  reporters.get('stack A')!('过期阶段');
  assert.equal(a.stage, undefined);
  assert.equal(a.loading, false);
  pending.resolve('restored');
  await new Promise((resolve) => setImmediate(resolve));
});

test('retrace loading is isolated by text ID and repeated automatic requests are deduplicated', async () => {
  const first = Promise.withResolvers<string>();
  const second = Promise.withResolvers<string>();
  mocks.retrace.mockImplementation((text: string) =>
    text === 'stack A' ? first.promise : second.promise,
  );
  const retrace = createRetrace();
  const a = retrace.getRetraceTextState('a', 'stack A');
  const b = retrace.getRetraceTextState('b', 'stack B');
  const applyA = vi.fn(),
    applyB = vi.fn();
  retrace.autoRetraceText(a, 'log', () => true, applyA);
  retrace.autoRetraceText(a, 'log', () => true, applyA);
  retrace.autoRetraceText(b, 'crash', () => true, applyB);
  assert.equal(mocks.retrace.mock.calls.length, 2);
  assert.equal(a.loading, true);
  assert.equal(b.loading, true);
  first.resolve('restored A');
  await vi.waitFor(() => assert.equal(a.loading, false));
  assert.equal(b.loading, true);
  assert.equal(a.active, true);
  assert.equal(applyA.mock.calls[0][0], 'restored A');
  second.resolve('restored B');
  await vi.waitFor(() => assert.equal(b.loading, false));
  retrace.autoRetraceText(a, 'log', () => true, applyA);
  assert.equal(a.active, true);
  assert.equal(mocks.retrace.mock.calls.length, 2);
});

test('expired views and reset builds cannot publish retrace data or errors', async () => {
  const first = Promise.withResolvers<string>();
  mocks.retrace.mockReturnValue(first.promise);
  const retrace = createRetrace();
  const state = retrace.getRetraceTextState('a', 'stack A');
  let current = true;
  const apply = vi.fn();
  retrace.autoRetraceText(state, 'log', () => current, apply);
  current = false;
  first.resolve('old result');
  await vi.waitFor(() => assert.equal(state.loading, false));
  assert.equal(state.active, false);
  assert.equal(state.retracedText, undefined);
  assert.equal(apply.mock.calls.length, 0);
  const second = Promise.withResolvers<string>();
  mocks.retrace.mockReturnValue(second.promise);
  const next = retrace.getRetraceTextState('b', 'stack B');
  retrace.autoRetraceText(next, 'log', () => true, apply);
  retrace.resetBuildRetrace();
  second.reject(new Error('obsolete'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(apply.mock.calls.length, 0);
  assert.equal(mocks.error.mock.calls.length, 0);
});

test('new text at the same ID replaces the pending read instead of sharing its old result', async () => {
  const old = Promise.withResolvers<string>();
  mocks.retrace
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce('new result');
  const retrace = createRetrace();
  const oldState = retrace.getRetraceTextState('same', 'stack old');
  const apply = vi.fn();
  retrace.autoRetraceText(oldState, 'log', () => true, apply);
  const next = retrace.getRetraceTextState('same', 'stack new');
  retrace.autoRetraceText(next, 'log', () => true, apply);
  await vi.waitFor(() => assert.equal(next.loading, false));
  old.resolve('old result');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(apply.mock.calls, [['new result']]);
  assert.equal(oldState.active, false);
});
