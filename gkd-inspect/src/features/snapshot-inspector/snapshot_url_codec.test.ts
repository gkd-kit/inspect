import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeLegacySelectorQuery,
  decodeSnapshotUrlState,
  encodeSnapshotUrlState,
  encodeSnapshotUrlStateParam,
  isDefaultSnapshotUrlState,
  MAX_SNAPSHOT_URL_QUERY_SIZE,
  type SnapshotUrlState,
} from './snapshot_url_codec.ts';

test('短状态使用无填充 Base64URL 往返', async () => {
  const state: SnapshotUrlState = {
    focusNodeId: 123,
    queries: [{ type: 'text', value: '确定' }],
  };
  const encoded = await encodeSnapshotUrlState(state);

  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes('='), false);
  assert.deepEqual(await decodeSnapshotUrlState(encoded), state);
});

test('默认状态规范化为空对象且不生成 URL 参数', async () => {
  assert.equal(isDefaultSnapshotUrlState({}), true);
  assert.equal(isDefaultSnapshotUrlState({ queries: [] }), true);
  assert.equal(await encodeSnapshotUrlStateParam({}), undefined);

  const legacyDefault = await encodeSnapshotUrlState({ queries: [] });
  assert.deepEqual(await decodeSnapshotUrlState(legacyDefault), {});
  assert.equal(
    await encodeSnapshotUrlStateParam({
      focusNodeId: 1,
    }),
    await encodeSnapshotUrlState({ focusNodeId: 1 }),
  );
});

test('重复查询历史会被压缩后往返', async () => {
  const repeatedSelector =
    '@TextView[text="重复内容"] <<n [vid="com.example:id/content"]';
  const state: SnapshotUrlState = {
    focusNodeId: 456,
    queries: Array.from({ length: 20 }, (_, index) => ({
      type: 'selector' as const,
      value: `${repeatedSelector}[index=${index}]`,
    })),
  };
  const encoded = await encodeSnapshotUrlState(state);

  assert.ok(encoded.length < JSON.stringify(state).length / 2);
  assert.deepEqual(await decodeSnapshotUrlState(encoded), state);
});

test('拒绝非法或超限状态', async () => {
  await assert.rejects(() => decodeSnapshotUrlState('AA'));
  await assert.rejects(() =>
    encodeSnapshotUrlState({
      queries: Array.from(
        { length: MAX_SNAPSHOT_URL_QUERY_SIZE + 1 },
        () => ({ type: 'text', value: 'x' }) as const,
      ),
    }),
  );
});

test('兼容旧 gkd Base64URL 参数', () => {
  assert.equal(decodeLegacySelectorQuery('5L2g5aW9'), '你好');
});
