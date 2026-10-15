import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCrashTimestamp,
  getCrashEntries,
  isCrashJsonPath,
  isCrashPath,
  loadCrashSummaries,
  parseCrashDetail,
  parseCrashSummary,
} from './crash_preview.ts';

test(`识别 crash 目录中的文件和 JSON`, () => {
  assert.equal(isCrashPath(`crash/a.json`), true);
  assert.equal(isCrashPath(`Crash/nested/a.json`), true);
  assert.equal(isCrashPath(`crash.json`), false);
  assert.equal(isCrashPath(`other/crash/a.json`), false);
  assert.equal(isCrashJsonPath(`crash/a.JSON`), true);
  assert.equal(isCrashJsonPath(`crash/a.txt`), false);
  assert.deepEqual(
    getCrashEntries([
      { path: `apps.json` },
      { path: `crash/a.json` },
      { path: `crash/nested/b.json` },
    ]),
    [{ path: `crash/a.json` }, { path: `crash/nested/b.json` }],
  );
});

test(`崩溃 JSON 转换为列表摘要和详情`, () => {
  const raw = JSON.stringify({
    id: 1_786_172_531_578,
    mtime: 1_786_172_531_578,
    device: `Xiaomi/Redmi`,
    androidVersionCode: 36,
    androidVersionName: `16`,
    versionCode: 92,
    versionName: `1.12.1`,
    name: `java.lang.RuntimeException`,
    message: `Unable to create service`,
    thread: `main`,
    stackTrace: `java.lang.RuntimeException\n\tat Example.run`,
  });
  const summary = parseCrashSummary(raw, `crash/a.json`);
  assert.equal(summary.status, `valid`);
  assert.equal(summary.timestamp, 1_786_172_531_578);
  assert.equal(summary.name, `java.lang.RuntimeException`);
  assert.equal(`stackTrace` in summary, false);

  const detail = parseCrashDetail(raw, `crash/a.json`);
  assert.equal(detail.parsed, true);
  assert.equal(
    detail.stackTrace,
    `java.lang.RuntimeException\n\tat Example.run`,
  );
  assert.deepEqual(detail.value, JSON.parse(raw));
});

test(`时间依次回退到 id 和文件名`, () => {
  assert.equal(
    parseCrashSummary(
      JSON.stringify({ id: 1_786_172_531, name: `Error`, stackTrace: `stack` }),
      `crash/a.json`,
    ).timestamp,
    1_786_172_531_000,
  );
  const item = parseCrashSummary(
    JSON.stringify({ name: `Error`, stackTrace: `stack` }),
    `crash/gkd_crash-20260808_150211.json`,
  );
  assert.equal(formatCrashTimestamp(item.timestamp), `2026-08-08 15:02:11.000`);
});

test(`字段缺失和非法 JSON 安全降级`, () => {
  assert.equal(
    parseCrashSummary(`null`, `crash/null.json`).status,
    `incomplete`,
  );
  const invalid = parseCrashDetail(`{`, `crash/invalid.json`);
  assert.equal(invalid.status, `invalid`);
  assert.equal(invalid.parsed, false);
  assert.equal(invalid.raw, `{`);
  assert.ok(invalid.error);
});

test(`批量读取按时间倒序且隔离单文件错误`, async () => {
  const entries = [
    { path: `crash/old.json` },
    { path: `crash/new.json` },
    { path: `crash/read-error.json` },
    { path: `crash/note.txt` },
  ];
  const values: Record<string, string> = {
    'crash/old.json': JSON.stringify({
      mtime: 1_000_000_000,
      name: `OldError`,
      stackTrace: `old`,
    }),
    'crash/new.json': JSON.stringify({
      mtime: 2_000_000_000,
      name: `NewError`,
      stackTrace: `new`,
    }),
  };
  const items = await loadCrashSummaries(entries, async (entry) => {
    const value = values[entry.path];
    if (value == null) throw new Error(`read failed`);
    return value;
  });
  assert.deepEqual(
    items.map((item) => item.path),
    [
      `crash/new.json`,
      `crash/old.json`,
      `crash/read-error.json`,
      `crash/note.txt`,
    ],
  );
  assert.equal(items[2].status, `invalid`);
  assert.equal(items[3].status, `unsupported`);
});

test(`没有 crash 文件时不触发读取`, async () => {
  let reads = 0;
  const items = await loadCrashSummaries([{ path: `apps.json` }], async () => {
    reads++;
    return `{}`;
  });
  assert.deepEqual(items, []);
  assert.equal(reads, 0);
});
