import { computed, shallowReactive, shallowRef } from 'vue';

export interface TaskProgress {
  completed?: number;
  total?: number;
  stage?: string;
}

export interface TaskContext {
  isCurrent: () => boolean;
  commit: (update: () => undefined) => boolean;
  commitIncrement: (update: () => undefined) => boolean;
  reportProgress: (progress: TaskProgress) => boolean;
}

export type TaskResult<T> =
  | { status: 'success'; value: T }
  | { status: 'error'; error: Error }
  | { status: 'stale' };

type TaskExecution = (
  | { status: 'idle' | 'pending' | 'success' }
  | { status: 'error'; error: Error }
) & { progress?: Readonly<TaskProgress> };

// Explicit increments may precede the final commit. Every commit is synchronous;
// only the latest still-running invocation may publish data or progress.
export const useLatestTask = <Args extends unknown[], T>(
  execute: (context: TaskContext, ...args: Args) => Promise<T>,
) => {
  const execution = shallowRef<TaskExecution>({ status: 'idle' });
  let revision = 0;
  const cancel = () => {
    revision += 1;
    execution.value = { status: 'idle' };
  };
  const run = async (...args: Args): Promise<TaskResult<T>> => {
    const current = ++revision;
    let committed = false;
    let active = true;
    let progress: Readonly<TaskProgress> | undefined;
    const isCurrent = () => active && current === revision;
    const commitUpdate = (update: () => undefined, final: boolean) => {
      if (!isCurrent()) return false;
      if (committed) throw new Error('最终提交后不能继续提交业务状态');
      if (final) committed = true;
      update();
      return true;
    };
    execution.value = { status: 'pending' };
    try {
      const value = await execute(
        {
          isCurrent,
          commit: (update) => commitUpdate(update, true),
          commitIncrement: (update) => commitUpdate(update, false),
          reportProgress(value) {
            if (!isCurrent()) return false;
            const { completed, total, stage } = value;
            if (
              [completed, total].some(
                (count) =>
                  count !== undefined && (!Number.isFinite(count) || count < 0),
              ) ||
              (completed !== undefined &&
                total !== undefined &&
                completed > total)
            )
              throw new Error('任务进度必须是非负有限数，已完成量不能超过总量');
            progress = Object.freeze({ completed, total, stage });
            execution.value = { status: 'pending', progress };
            return true;
          },
        },
        ...args,
      );
      if (!isCurrent()) return { status: 'stale' };
      execution.value = { status: 'success', progress };
      return { status: 'success', value };
    } catch (cause) {
      if (!isCurrent()) return { status: 'stale' };
      const error = cause instanceof Error ? cause : new Error(String(cause));
      execution.value = { status: 'error', error, progress };
      return { status: 'error', error };
    } finally {
      active = false;
    }
  };
  return {
    run,
    cancel,
    clearError: () => {
      if (execution.value.status === 'error')
        execution.value = { status: 'idle' };
    },
    loading: computed(() => execution.value.status === 'pending'),
    progress: computed(() => execution.value.progress),
    error: computed(() =>
      execution.value.status === 'error' ? execution.value.error : undefined,
    ),
  };
};

// Writes run to completion; repeated clicks share the current invocation.
export const useSingleTask = <Args extends unknown[], T>(
  execute: (context: TaskContext, ...args: Args) => Promise<T>,
) => {
  const task = useLatestTask(execute);
  let pending: Promise<TaskResult<T>> | undefined;
  const run = (...args: Args): Promise<TaskResult<T>> => {
    if (pending) return pending;
    const { promise, resolve } = Promise.withResolvers<TaskResult<T>>();
    pending = promise;
    void task.run(...args).then((result) => {
      pending = undefined;
      resolve(result);
    });
    return promise;
  };
  return { ...task, run };
};

export const useSerialTask = <Args extends unknown[], T>(
  execute: (context: TaskContext, ...args: Args) => Promise<T>,
) => {
  const task = useLatestTask(execute);
  const queued = shallowRef(0);
  let tail = Promise.resolve();
  const run = (...args: Args) => {
    queued.value++;
    const result = tail.then(() => task.run(...args)) as Promise<
      Exclude<TaskResult<T>, { status: 'stale' }>
    >;
    tail = result.then(() => {
      queued.value--;
    });
    return result;
  };
  return {
    run,
    loading: computed(() => queued.value > 0),
    error: task.error,
    progress: task.progress,
  };
};

export const useKeyedTask = <
  Key extends string | number,
  Args extends unknown[],
  T,
>(
  execute: (context: TaskContext, key: Key, ...args: Args) => Promise<T>,
) => {
  const tasks = shallowReactive(
    new Map<Key, ReturnType<typeof useSingleTask<Args, T>>>(),
  );
  const run = (key: Key, ...args: Args) => {
    let task = tasks.get(key);
    if (!task) {
      task = useSingleTask((context, ...values: Args) =>
        execute(context, key, ...values),
      );
      tasks.set(key, task);
    }
    return task.run(...args);
  };
  const cancel = (key: Key) => {
    tasks.get(key)?.cancel();
    tasks.delete(key);
  };
  const cancelAll = () => {
    for (const key of tasks.keys()) cancel(key);
  };
  return {
    run,
    cancel,
    cancelAll,
    loading: computed(
      () =>
        Object.fromEntries(
          [...tasks]
            .filter(([, task]) => task.loading.value)
            .map(([key]) => [key, true]),
        ) as Readonly<Partial<Record<Key, boolean>>>,
    ),
    errors: computed(
      () =>
        Object.fromEntries(
          [...tasks]
            .filter(([, task]) => task.error.value)
            .map(([key, task]) => [key, task.error.value!]),
        ) as Readonly<Partial<Record<Key, Error>>>,
    ),
  };
};
