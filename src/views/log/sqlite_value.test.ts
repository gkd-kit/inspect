import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSqliteTimeValue,
  isSqliteAppIdColumn,
  isSqliteSubscriptionIdColumn,
} from './sqlite_value.ts';

test(`app_id 和 app_visit_log.id 识别为应用 ID`, () => {
  assert.equal(isSqliteAppIdColumn(`action_log`, `app_id`), true);
  assert.equal(isSqliteAppIdColumn(`APP_VISIT_LOG`, `ID`), true);
  assert.equal(isSqliteAppIdColumn(`action_log`, `id`), false);
});

test(`指定表的 subs_id 识别为订阅 ID`, () => {
  assert.equal(isSqliteSubscriptionIdColumn(`app_visit_log`, `subs_id`), true);
  assert.equal(isSqliteSubscriptionIdColumn(`SUBS_CONFIG`, `SUBS_ID`), true);
  assert.equal(isSqliteSubscriptionIdColumn(`action_log`, `subs_id`), false);
});

test(`ctime 和 mtime 支持毫秒与秒级时间戳`, () => {
  assert.equal(
    getSqliteTimeValue(`action_log`, `ctime`, 1_784_114_426_984)?.getTime(),
    1_784_114_426_984,
  );
  assert.equal(
    getSqliteTimeValue(`app_visit_log`, `MTIME`, 1_784_114_426)?.getTime(),
    1_784_114_426_000,
  );
});

test(`snapshot.id 和 subs_config.id 识别为时间戳`, () => {
  assert.equal(
    getSqliteTimeValue(`snapshot`, `id`, 1_774_486_859_361)?.getTime(),
    1_774_486_859_361,
  );
  assert.equal(
    getSqliteTimeValue(`SUBS_CONFIG`, `ID`, 1_743_910_964_920)?.getTime(),
    1_743_910_964_920,
  );
});

test(`普通字段和非法时间值保持原始展示`, () => {
  assert.equal(
    getSqliteTimeValue(`action_log`, `id`, 1_784_114_426_984),
    undefined,
  );
  assert.equal(
    getSqliteTimeValue(`action_log`, `created_at`, 1_784_114_426_984),
    undefined,
  );
  assert.equal(getSqliteTimeValue(`action_log`, `ctime`, `invalid`), undefined);
});
