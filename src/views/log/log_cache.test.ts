import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isFreshLogArchiveCacheEntry,
  LOG_ARCHIVE_CACHE_TTL,
  type LogArchiveCacheEntry,
} from './log_cache.ts';

const createEntry = (cachedAt: number): LogArchiveCacheEntry => ({
  version: 1,
  cachedAt,
  expiresAt: cachedAt + LOG_ARCHIVE_CACHE_TTL,
  name: `log.zip`,
  data: new ArrayBuffer(8),
});

test(`远程日志缓存在七天内有效`, () => {
  const now = 1_000_000;
  const entry = createEntry(now);
  assert.equal(
    isFreshLogArchiveCacheEntry(entry, now + LOG_ARCHIVE_CACHE_TTL - 1),
    true,
  );
});

test(`远程日志缓存满七天后失效`, () => {
  const now = 1_000_000;
  const entry = createEntry(now);
  assert.equal(
    isFreshLogArchiveCacheEntry(entry, now + LOG_ARCHIVE_CACHE_TTL),
    false,
  );
});
