import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectRemoteSnapshot,
  getSnapshotImportId,
  getWorkersProxyUrl,
} from './workers.ts';

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
  globalThis.fetch = (async () => {
    return Response.json({ error: true, message: `invalid snapshot` });
  }) as typeof fetch;
  try {
    await assert.rejects(getSnapshotImportId(123), /invalid snapshot/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(`代理地址只接受 Worker 白名单内的 GitHub ZIP`, () => {
  const targetUrl =
    `https://github.com/user-attachments/files/29669330/` +
    `log-1784092724705.zip`;
  assert.equal(
    String(getWorkersProxyUrl(targetUrl)),
    `https://api.gkd.li/proxy?url=${encodeURIComponent(targetUrl)}`,
  );
  assert.equal(getWorkersProxyUrl(`https://example.com/file.zip`), undefined);
});

test(`f.gkd.li 短链在进入代理前转换为 GitHub ZIP`, () => {
  const targetUrl = `https://github.com/user-attachments/files/29669330/file.zip`;
  assert.equal(
    String(getWorkersProxyUrl(`https://f.gkd.li/29669330`)),
    `https://api.gkd.li/proxy?url=${encodeURIComponent(targetUrl)}`,
  );
});
