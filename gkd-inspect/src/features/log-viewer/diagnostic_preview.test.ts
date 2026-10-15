import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatDiagnosticTime,
  getDiagnosticKind,
  getDiagnosticRows,
  getPermissionRows,
  isStartupPath,
  parseStartupSummary,
} from './diagnostic_preview.ts';

test(`只识别新诊断路径，旧权限文本继续普通预览`, () => {
  assert.equal(getDiagnosticKind(`metadata/permission.json`), `permission`);
  assert.equal(getDiagnosticKind(`metadata/storage.json`), `storage`);
  assert.equal(getDiagnosticKind(`startup-log/a.json`), `startup`);
  assert.equal(getDiagnosticKind(`permission.txt`), undefined);
  assert.equal(isStartupPath(`other/startup-log/a.json`), false);
});
test(`权限保留未知状态、缺失值与检查时间`, () => {
  const rows = getPermissionRows({
    timeZone: `Asia/Shanghai`,
    permissions: [
      { name: `通知`, status: `granted`, checkedAt: 0 },
      { status: `future` },
      null,
    ],
  });
  assert.equal(rows[0].status, `已授权`);
  assert.match(rows[0].checkedAt, /08:00:00/);
  assert.equal(rows[1].status, `future`);
  assert.equal(rows[2].status, `未知`);
  assert.deepEqual(getPermissionRows(null), []);
  assert.equal(formatDiagnosticTime(0, `invalid`), `未知`);
});
test(`存储视图区分启动选择与当前诊断，不丢失 false 和 null`, () => {
  const rows = getDiagnosticRows(`storage`, {
    selectionAtStartup: {
      selectedPath: `/old`,
      markerBefore: false,
      markerCreated: null,
    },
    activeDirectory: `/active`,
    externalDiagnosticOnly: { path: `/diagnostic` },
  });
  const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(values[`启动时选择目录`], `/old`);
  assert.equal(values[`当前使用目录`], `/active`);
  assert.equal(values[`诊断时外部目录`], `/diagnostic`);
  assert.equal(values[`选择前标记`], `否`);
  assert.equal(values[`标记创建结果`], `未知`);
});
test(`启动记录损坏与字段不完整时保留条目`, () => {
  assert.ok(parseStartupSummary(`startup-log/bad.json`, `{`).error);
  assert.ok(parseStartupSummary(`startup-log/null.json`, `null`).error);
  const result = parseStartupSummary(
    `startup-log/a.json`,
    JSON.stringify({
      startedAt: 1000,
      processName: `app`,
      app: { versionName: `1.0` },
    }),
  );
  assert.equal(result.timestamp, 1000);
  assert.equal(result.version, `1.0`);
  assert.equal(result.device, `未知`);
});
