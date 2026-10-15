import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBuildAsset } from './build_asset_api.ts';

test(`根据 buildKey 查询构建附件 ID`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    assert.equal(
      String(input),
      `https://api.gkd.li/build-asset/getBuildAsset?buildKey=gkd-build-123`,
    );
    return Response.json({ assetId: 456 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await getBuildAsset(`gkd-build-123`), { assetId: 456 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(`拒绝非法构建附件 ID`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({ assetId: 0 })) as typeof fetch;
  try {
    await assert.rejects(
      getBuildAsset(`gkd-build-123`),
      /invalid build asset ID/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
