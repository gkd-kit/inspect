import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectRetraceTextBlocks,
  getR8MapIds,
  hasRetraceableStack,
  retraceCrashText,
  retraceLogText,
} from './retrace_text.ts';

const mapId = `a844dcdfb50535c049c7af75c2042fdb77cf67bac59990ab361b28fb86843812`;
const otherMapId = `13f77dbb909b620d9ae48daa00701bdd1a535d4aa2b84921ad840ad50cdeb672`;

test(`只把带 map id 的堆栈帧视为懒加载触发信号`, () => {
  assert.equal(hasRetraceableStack(`r8-map-id-${mapId}`), false);
  assert.equal(hasRetraceableStack(`\tat a.b(r8-map-id-${mapId}:1)`), true);
  assert.deepEqual(
    getR8MapIds(`at a.b(r8-map-id-${mapId}:1)\nat c.d(r8-map-id-${mapId}:2)`),
    [mapId],
  );
});

test(`收集完整异常块并保留未混淆帧、Caused by 和省略帧`, () => {
  const stack = [
    `00:40:23.970 CoroutineExt, worker-1, util.launchTry(CoroutineExt.kt:27)`,
    `java.net.SocketTimeoutException: request timeout`,
    `\tat a.b(r8-map-id-${mapId}:51)`,
    `\tat java.lang.Thread.run(Thread.java:1015)`,
    `Caused by: java.net.SocketTimeoutException: timeout`,
    `\tat c.d(r8-map-id-${mapId}:5)`,
    `\t... 3 more`,
    ``,
    `00:40:24.000 next record`,
  ].join(`\r\n`);
  const blocks = collectRetraceTextBlocks(stack);
  assert.equal(blocks.length, 1);
  assert.equal(
    blocks[0]?.text,
    stack.slice(
      stack.indexOf(`java.net.SocketTimeoutException`),
      stack.indexOf(`\r\n\r\n`),
    ),
  );
});

test(`Kotlin 风格异常头和带索引异常头都能组成完整块`, () => {
  const text = [
    `GithubCookieException(message=cookie invalid)`,
    `\tat a.b(r8-map-id-${mapId}:1)`,
    ``,
    `[2]: java.lang.ClassCastException: failed`,
    `\tat c.d(r8-map-id-${mapId}:2)`,
  ].join(`\n`);
  assert.equal(collectRetraceTextBlocks(text).length, 2);
});

test(`异常首帧前的多行 message 会保留在完整异常块中`, () => {
  const text = [
    `java.lang.IllegalStateException: first line`,
    `second line`,
    `third line`,
    `\tat a.b(r8-map-id-${mapId}:1)`,
  ].join(`\n`);
  const blocks = collectRetraceTextBlocks(text);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.text, text);
});

test(`日志只替换当前 mapping 对应的完整异常块`, () => {
  const current = `java.lang.IllegalStateException: current\n\tat a.b(r8-map-id-${mapId}:1)`;
  const historical = `java.lang.IllegalStateException: old\n\tat c.d(r8-map-id-${otherMapId}:2)`;
  const text = `before\n${current}\n\n${historical}\n\nafter`;
  assert.equal(
    retraceLogText(text, mapId, (stack) => `[retraced]\n${stack}`),
    `before\n[retraced]\n${current}\n\n${historical}\n\nafter`,
  );
});

test(`crash 仅在所有帧都属于当前 mapping 时整体还原`, () => {
  const stack = `java.lang.Error: failed\n\tat a.b(r8-map-id-${mapId}:1)`;
  assert.equal(
    retraceCrashText(stack, mapId, () => `retraced`),
    `retraced`,
  );
  assert.equal(
    retraceCrashText(
      `${stack}\n\tat c.d(r8-map-id-${otherMapId}:2)`,
      mapId,
      () => `bad`,
    ),
    `${stack}\n\tat c.d(r8-map-id-${otherMapId}:2)`,
  );
});
