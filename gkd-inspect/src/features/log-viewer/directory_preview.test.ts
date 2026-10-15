import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatLogFileDate,
  getLogDirectoryEntries,
  getLogFileSummaries,
  getSubscriptionDirectoryEntries,
  isLogDirectoryPath,
  isSubscriptionDirectoryPath,
  loadSubscriptionFileSummaries,
  parseSubscriptionFileDetail,
  parseSubscriptionFileSummary,
} from './directory_preview.ts';

test(`识别 log 和 subscription 目录文件`, () => {
  assert.equal(isLogDirectoryPath(`log/gkd.log`), true);
  assert.equal(isLogDirectoryPath(`logs/gkd.log`), false);
  assert.equal(isSubscriptionDirectoryPath(`subscription/0.json`), true);
  assert.equal(isSubscriptionDirectoryPath(`other/subscription/0.json`), false);
  const entries = [
    { path: `apps.json` },
    { path: `log/gkd.log` },
    { path: `subscription/0.json` },
  ];
  assert.deepEqual(getLogDirectoryEntries(entries), [{ path: `log/gkd.log` }]);
  assert.deepEqual(getSubscriptionDirectoryEntries(entries), [
    { path: `subscription/0.json` },
  ]);
});

test(`日志文件按文件名日期倒序展示`, () => {
  const items = getLogFileSummaries([
    { path: `log/gkd-20260812.log`, size: 12 },
    { path: `log/gkd-20260819.log`, size: 19 },
    { path: `log/other.log`, size: 1 },
  ]);
  assert.deepEqual(
    items.map((item) => item.path),
    [`log/gkd-20260819.log`, `log/gkd-20260812.log`, `log/other.log`],
  );
  assert.equal(formatLogFileDate(items[0].timestamp), `2026-08-19`);
  assert.equal(items[0].size, 19);
});

test(`订阅 JSON 转换为列表摘要和详情`, () => {
  const raw = JSON.stringify({
    id: 666,
    name: `示例订阅`,
    version: 10,
    author: `作者`,
    apps: [{ id: `example`, groups: [] }],
    globalGroups: [{ key: 1, name: `全局`, rules: [] }],
    categories: [{ key: 1, name: `分类` }],
  });
  assert.deepEqual(parseSubscriptionFileSummary(raw, `subscription/666.json`), {
    path: `subscription/666.json`,
    fileName: `666.json`,
    status: `valid`,
    id: 666,
    name: `示例订阅`,
    version: 10,
    author: `作者`,
    appsCount: 1,
    globalGroupsCount: 1,
    categoriesCount: 1,
  });
  const detail = parseSubscriptionFileDetail(raw, `subscription/666.json`);
  assert.equal(detail.parsed, true);
  assert.deepEqual(detail.value, JSON.parse(raw));
});

test(`订阅字段缺失和非法 JSON 安全降级`, () => {
  assert.equal(
    parseSubscriptionFileSummary(`{}`, `subscription/233.json`).status,
    `incomplete`,
  );
  const invalid = parseSubscriptionFileDetail(`{`, `subscription/233.json`);
  assert.equal(invalid.status, `invalid`);
  assert.equal(invalid.parsed, false);
  assert.equal(invalid.raw, `{`);
});

test(`订阅批量读取按 ID 排序并隔离单文件错误`, async () => {
  const entries = [
    { path: `subscription/666.json` },
    { path: `subscription/-2.json` },
    { path: `subscription/bad.json` },
    { path: `subscription/readme.txt` },
  ];
  const values: Record<string, string> = {
    'subscription/666.json': JSON.stringify({
      id: 666,
      name: `远程订阅`,
      version: 1,
    }),
    'subscription/-2.json': JSON.stringify({
      id: -2,
      name: `本地订阅`,
      version: 1,
    }),
  };
  const items = await loadSubscriptionFileSummaries(entries, async (entry) => {
    const value = values[entry.path];
    if (value == null) throw new Error(`read failed`);
    return value;
  });
  assert.deepEqual(
    items.map((item) => item.path),
    [
      `subscription/-2.json`,
      `subscription/666.json`,
      `subscription/bad.json`,
      `subscription/readme.txt`,
    ],
  );
  assert.equal(items[2].status, `invalid`);
  assert.equal(items[3].status, `unsupported`);
});

test(`没有 subscription 文件时不触发读取`, async () => {
  let reads = 0;
  const items = await loadSubscriptionFileSummaries(
    [{ path: `apps.json` }],
    async () => {
      reads++;
      return `{}`;
    },
  );
  assert.deepEqual(items, []);
  assert.equal(reads, 0);
});
