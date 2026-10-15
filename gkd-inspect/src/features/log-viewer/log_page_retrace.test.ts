import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createSharedTaskPool } from './retrace_client.ts';

const source = readFileSync(
  new URL(`./LogViewerView.vue`, import.meta.url),
  `utf8`,
);
const retraceSource = readFileSync(
  new URL(`./useLogRetrace.ts`, import.meta.url),
  `utf8`,
);
const clientSource = readFileSync(
  new URL(`./retrace_client.ts`, import.meta.url),
  `utf8`,
);

test(`打开普通文本、日志文件和崩溃文件时自动触发堆栈还原`, () => {
  const autoRetraceCalls = source.match(/autoRetraceText\(\s*state,/g) || [];

  assert.equal(autoRetraceCalls.length, 3);
  assert.match(
    source,
    /previewKind\.value = `text`;\s+autoRetraceText\(\s*state,\s*`log`,/,
  );
  assert.match(
    source,
    /stackTrace: getRetraceStateText\(state\),\s+}\);\s+autoRetraceText\(\s*state,\s*`crash`,/,
  );
  assert.match(
    source,
    /logDetailText\.value = getRetraceStateText\(state\);\s+autoRetraceText\(\s*state,\s*`log`,/,
  );
});

test(`自动触发只处理混淆堆栈且不会把已还原的缓存状态切回原文`, () => {
  assert.match(
    retraceSource,
    /const autoRetraceText[\s\S]*?if \(!state\?\.available \|\| state\.autoAttempted\) return;[\s\S]*?state\.autoAttempted = true;[\s\S]*?void toggleRetraceText/,
  );
});

test(`构建附件只共享进行中的任务并支持会话取消`, () => {
  assert.match(clientSource, /void task\s*\.finally\(/);
  assert.match(clientSource, /getBuildAsset\(buildKey, signal\)/);
  assert.match(
    clientSource,
    /fetch\(proxyUrl, \{ credentials: `omit`, signal \}\)/,
  );
});

test(`共享任务池只复用进行中的任务并在最后一个消费者离开时取消`, async () => {
  let calls = 0;
  let activeSignal: AbortSignal | undefined;
  const acquire = createSharedTaskPool<number>((_key, signal) => {
    calls++;
    activeSignal = signal;
    return new Promise(() => {});
  });
  const first = acquire(`same`);
  const second = acquire(`same`);
  assert.equal(calls, 1);
  assert.equal(first.task, second.task);
  first.release();
  assert.equal(activeSignal?.aborted, false);
  second.release();
  assert.equal(activeSignal?.aborted, true);
});

test(`共享任务完成后会释放结果并允许后续重新加载`, async () => {
  let calls = 0;
  const acquire = createSharedTaskPool(async () => ++calls);
  const first = acquire(`same`);
  assert.equal(await first.task, 1);
  first.release();
  const second = acquire(`same`);
  assert.equal(await second.task, 2);
  second.release();
});

test(`注册失败会清理附件缓存且 Worker 停止后允许重新初始化`, () => {
  assert.match(clientSource, /removeBuildAssetCache\(asset\.assetId\)/);
  assert.match(
    clientSource,
    /private stopWorker[\s\S]*?this\.initializeTask = undefined;/,
  );
});

test(`过期会话不会显示还原结果或错误`, () => {
  assert.match(retraceSource, /if \(!isCurrent\(\)\) return;/);
  assert.match(
    retraceSource,
    /if \(error instanceof DOMException && error\.name == `AbortError`\)/,
  );
});
