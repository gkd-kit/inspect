import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectRemoteSnapshot, getSnapshotImportId } from './api.ts';

test(`查询快照映射使用 Workers API 新路由`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    assert.equal(
      String(input),
      `https://api.gkd.li/snapshot-detect/getImportId?id=123`,
    );
    return Response.json(456);
  }) as typeof fetch;
  try {
    assert.equal(await getSnapshotImportId(123), 456);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(`登记快照映射使用 JSON POST`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      String(input),
      `https://api.gkd.li/snapshot-detect/detectSnapshot`,
    );
    assert.equal(init?.method, `POST`);
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      id: 123,
      importId: 456,
    });
    return Response.json({ id: 123, importId: 456, created: true });
  }) as typeof fetch;
  try {
    assert.deepEqual(await detectRemoteSnapshot(123, 456), {
      id: 123,
      importId: 456,
      created: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(`Workers API 业务错误会被识别`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      error: true,
      message: `invalid snapshot`,
    })) as typeof fetch;
  try {
    await assert.rejects(getSnapshotImportId(123), /invalid snapshot/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
