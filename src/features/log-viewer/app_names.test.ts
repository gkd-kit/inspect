import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAppNameMapFromValue } from './app_names.ts';

test(`apps.json 转换为应用 ID 与名称映射`, () => {
  assert.deepEqual(
    getAppNameMapFromValue({
      userId: 0,
      apps: [
        { id: `com.example.one`, name: `示例应用`, versionCode: 1 },
        { id: `com.example.two`, name: `Example`, versionCode: 2 },
      ],
    }),
    {
      'com.example.one': `示例应用`,
      'com.example.two': `Example`,
    },
  );
});

test(`apps.json 缺失或包含非法应用项时安全忽略`, () => {
  assert.deepEqual(getAppNameMapFromValue(undefined), {});
  assert.deepEqual(
    getAppNameMapFromValue({
      apps: [null, { id: 1, name: `invalid` }, { id: `valid`, name: `有效` }],
    }),
    { valid: `有效` },
  );
});
