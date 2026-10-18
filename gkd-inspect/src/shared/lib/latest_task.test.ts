import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  useLatestTask,
  useSingleTask,
  useSerialTask,
  useKeyedTask,
  type TaskContext,
} from './latest_task';

test('only the newest task may commit or update execution status', async () => {
  const first = Promise.withResolvers<number>();
  const second = Promise.withResolvers<number>();
  let value = 0;
  const task = useLatestTask(async (context, pending: Promise<number>) => {
    const result = await pending;
    context.commit(() => {
      value = result;
    });
    return result;
  });
  const oldRun = task.run(first.promise);
  const newRun = task.run(second.promise);
  first.resolve(1);
  assert.equal((await oldRun).status, 'stale');
  assert.equal(value, 0);
  assert.equal(task.loading.value, true);
  second.resolve(2);
  assert.equal((await newRun).status, 'success');
  assert.equal(value, 2);
  assert.equal(task.loading.value, false);
});

test('derives errors, resets them on retry, and ignores failures after cancellation', async () => {
  const task = useLatestTask(
    async (_context, pending: Promise<void>) => pending,
  );
  const failure = new Error('failed');
  await task.run(Promise.reject(failure));
  assert.equal(task.error.value, failure);
  const pending = Promise.withResolvers<void>();
  const run = task.run(pending.promise);
  assert.equal(task.error.value, undefined);
  task.cancel();
  pending.reject(new Error('late failure'));
  assert.equal((await run).status, 'stale');
  assert.equal(task.error.value, undefined);
  assert.equal(task.loading.value, false);
});

test('rejects a second business commit in one invocation', async () => {
  let value = 0;
  const task = useLatestTask(async (context) => {
    context.commit(() => {
      value = 1;
    });
    await Promise.resolve();
    context.commit(() => {
      value = 2;
    });
  });
  assert.equal((await task.run()).status, 'error');
  assert.equal(value, 1);
});

test('streams consistent increments, reports progress, and optionally commits a final result', async () => {
  const next = Promise.withResolvers<void>();
  const rows: string[] = [];
  let count = 0;
  let complete = false;
  const task = useLatestTask(async (context) => {
    context.reportProgress({ stage: '读取', completed: 0, total: 2 });
    context.commitIncrement(() => {
      rows.push('first');
      count = rows.length;
    });
    context.reportProgress({ stage: '读取', completed: count, total: 2 });
    await next.promise;
    context.commitIncrement(() => {
      rows.push('second');
      count = rows.length;
    });
    context.commit(() => {
      complete = true;
    });
    context.reportProgress({ stage: '完成', completed: count, total: 2 });
  });
  const run = task.run();
  assert.deepEqual(rows, ['first']);
  assert.equal(count, 1);
  assert.equal(complete, false);
  assert.equal(task.progress.value?.completed, 1);
  assert.equal(task.loading.value, true);
  next.resolve();
  assert.equal((await run).status, 'success');
  assert.deepEqual(rows, ['first', 'second']);
  assert.equal(count, 2);
  assert.equal(complete, true);
  assert.equal(task.progress.value?.stage, '完成');
  assert.equal(task.progress.value?.completed, 2);
});

test('replaced or cancelled tasks cannot publish increments or progress', async () => {
  const contexts: TaskContext[] = [];
  let count = 0;
  const task = useLatestTask(async (context, pending: Promise<void>) => {
    contexts.push(context);
    context.reportProgress({ completed: 1, total: 3 });
    await pending;
  });
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const oldRun = task.run(first.promise);
  const newRun = task.run(second.promise);
  assert.equal(contexts[0].reportProgress({ completed: 3, total: 3 }), false);
  assert.equal(
    contexts[0].commitIncrement(() => {
      count += 1;
    }),
    false,
  );
  assert.equal(task.progress.value?.completed, 1);
  task.cancel();
  assert.equal(task.progress.value, undefined);
  assert.equal(contexts[1].reportProgress({ completed: 2 }), false);
  assert.equal(
    contexts[1].commitIncrement(() => {
      count += 1;
    }),
    false,
  );
  first.resolve();
  second.resolve();
  assert.equal((await oldRun).status, 'stale');
  assert.equal((await newRun).status, 'stale');
  assert.equal(count, 0);
  assert.equal(task.progress.value, undefined);
});

test('a finished context cannot publish detached callbacks after success or failure', async () => {
  for (const fail of [false, true]) {
    let context: TaskContext | undefined;
    let value = 0;
    const task = useLatestTask(async (current) => {
      context = current;
      current.reportProgress({ stage: '处理' });
      if (fail) throw new Error('failed');
    });
    await task.run();
    assert.ok(context);
    assert.equal(context.isCurrent(), false);
    assert.equal(
      context.commit(() => {
        value = 1;
      }),
      false,
    );
    assert.equal(
      context.commitIncrement(() => {
        value = 2;
      }),
      false,
    );
    assert.equal(context.reportProgress({ stage: '迟到' }), false);
    assert.equal(task.progress.value?.stage, '处理');
    assert.equal(value, 0);
    assert.equal(task.loading.value, false);
  }
});

test('final commit seals incremental writes but still permits execution progress', async () => {
  let value = 0;
  const task = useLatestTask(async (context) => {
    context.commit(() => {
      value = 1;
    });
    await Promise.resolve();
    context.reportProgress({ stage: '收尾' });
    context.commitIncrement(() => {
      value = 2;
    });
  });
  assert.equal((await task.run()).status, 'error');
  assert.equal(value, 1);
  assert.equal(task.progress.value?.stage, '收尾');
});

test('progress is an immutable snapshot, resets on retry, and is not inferred on completion', async () => {
  let context: TaskContext | undefined;
  const task = useLatestTask(async (current, pending: Promise<void>) => {
    context = current;
    await pending;
  });
  const first = Promise.withResolvers<void>();
  const run = task.run(first.promise);
  const progress = { completed: 1, total: 5, stage: '处理' };
  context!.reportProgress(progress);
  progress.completed = 5;
  assert.equal(task.progress.value?.completed, 1);
  assert.equal(Object.isFrozen(task.progress.value), true);
  first.resolve();
  await run;
  assert.equal(task.progress.value?.completed, 1);
  const retry = Promise.withResolvers<void>();
  const rerun = task.run(retry.promise);
  assert.equal(task.progress.value, undefined);
  retry.resolve();
  await rerun;
});

test('rejects invalid progress without replacing the last valid report', async () => {
  for (const progress of [
    { completed: -1 },
    { total: Infinity },
    { completed: NaN },
    { completed: 2, total: 1 },
  ]) {
    const task = useLatestTask(async (context) => {
      context.reportProgress({ completed: 0, total: 1 });
      context.reportProgress(progress);
    });
    assert.equal((await task.run()).status, 'error');
    assert.equal(task.progress.value?.completed, 0);
  }
});

test('single-flight writes lock before the first await and share their result', async () => {
  const gate = Promise.withResolvers<void>();
  let writes = 0;
  const task = useSingleTask(async ({ commit }, value: number) => {
    writes++;
    await gate.promise;
    commit(() => {
      writes += value;
    });
    return value;
  });
  const first = task.run(2);
  const duplicate = task.run(10);
  assert.equal(first, duplicate);
  assert.equal(writes, 1);
  assert.equal(task.loading.value, true);
  gate.resolve();
  assert.deepEqual(await first, { status: 'success', value: 2 });
  assert.equal(writes, 3);
  await task.run(4);
  assert.equal(writes, 8);
});

test('serial writes commit in order and a failure does not discard the queue', async () => {
  const gate = Promise.withResolvers<void>();
  const started: number[] = [],
    committed: number[] = [];
  const task = useSerialTask(async ({ commit }, id: number) => {
    started.push(id);
    if (id === 1) await gate.promise;
    if (id === 2) throw new Error('failed');
    commit(() => {
      committed.push(id);
    });
    return id;
  });
  const runs = [task.run(1), task.run(2), task.run(3)];
  assert.equal(task.loading.value, true);
  await Promise.resolve();
  assert.deepEqual(started, [1]);
  gate.resolve();
  assert.deepEqual(
    (await Promise.all(runs)).map((result) => result.status),
    ['success', 'error', 'success'],
  );
  assert.deepEqual(started, [1, 2, 3]);
  assert.deepEqual(committed, [1, 3]);
  assert.equal(task.loading.value, false);
  assert.equal(task.error.value, undefined);
});

test('keyed tasks isolate loading, errors, cancellation and duplicate calls', async () => {
  const a = Promise.withResolvers<number>(),
    b = Promise.withResolvers<number>();
  const values: Record<string, number> = {};
  const task = useKeyedTask(
    async ({ commit }, id: string, pending: Promise<number>) => {
      const value = await pending;
      commit(() => {
        values[id] = value;
      });
    },
  );
  const first = task.run('a', a.promise);
  assert.equal(task.run('a', Promise.resolve(99)), first);
  const other = task.run('b', b.promise);
  task.cancel('a');
  assert.deepEqual(task.loading.value, { b: true });
  const newer = task.run('a', Promise.resolve(3));
  await newer;
  a.resolve(1);
  b.reject(new Error('b failed'));
  assert.equal((await first).status, 'stale');
  assert.equal((await other).status, 'error');
  assert.deepEqual(values, { a: 3 });
  assert.equal(task.errors.value.b?.message, 'b failed');
  await task.run('b', Promise.resolve(2));
  assert.deepEqual(task.errors.value, {});
  assert.deepEqual(values, { a: 3, b: 2 });
  task.cancelAll();
  assert.deepEqual(task.loading.value, {});
});
