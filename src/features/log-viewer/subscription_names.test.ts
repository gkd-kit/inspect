import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSubscriptionNameEntry } from './subscription_names.ts';

test(`订阅 JSON 转换为订阅 ID 与名称`, () => {
  assert.deepEqual(
    getSubscriptionNameEntry({ id: 667, name: `id667的GKD订阅🚀` }),
    [`667`, `id667的GKD订阅🚀`],
  );
  assert.deepEqual(getSubscriptionNameEntry({ id: -2, name: `本地订阅` }), [
    `-2`,
    `本地订阅`,
  ]);
});

test(`非法订阅 JSON 不生成名称映射`, () => {
  assert.equal(
    getSubscriptionNameEntry({ id: `667`, name: `订阅` }),
    undefined,
  );
  assert.equal(getSubscriptionNameEntry({ id: 667, name: `` }), undefined);
  assert.equal(getSubscriptionNameEntry(undefined), undefined);
});
