import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILD_ASSET_CACHE_TTL,
  isFreshBuildAssetCacheEntry,
  type BuildAssetCacheEntry,
} from './build_asset_cache.ts';

const createEntry = (cachedAt: number): BuildAssetCacheEntry => ({
  version: 1,
  assetId: 123,
  cachedAt,
  expiresAt: cachedAt + BUILD_ASSET_CACHE_TTL,
  data: new ArrayBuffer(8),
});

test(`构建附件 ZIP 缓存在七天内有效`, () => {
  const now = 1_000_000;
  assert.equal(
    isFreshBuildAssetCacheEntry(
      createEntry(now),
      now + BUILD_ASSET_CACHE_TTL - 1,
    ),
    true,
  );
});

test(`构建附件缓存拒绝过期或非法附件 ID`, () => {
  const now = 1_000_000;
  assert.equal(
    isFreshBuildAssetCacheEntry(createEntry(now), now + BUILD_ASSET_CACHE_TTL),
    false,
  );
  assert.equal(
    isFreshBuildAssetCacheEntry({ ...createEntry(now), assetId: 0 }, now),
    false,
  );
});
