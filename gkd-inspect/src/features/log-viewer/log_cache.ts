import localforage from 'localforage';

export const LOG_ARCHIVE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export const LOG_ARCHIVE_CACHE_MAX_ENTRIES = 10;
export const LOG_ARCHIVE_CACHE_MAX_SIZE = 200 * 1024 * 1024;

export type LogArchiveCacheEntry = {
  version: 1;
  cachedAt: number;
  expiresAt: number;
  name: string;
  data: ArrayBuffer;
};

const storage = localforage.createInstance({
  name: `gkd-inspect-log`,
  storeName: `remote_logs`,
  version: 1,
  driver: localforage.INDEXEDDB,
});

export const isFreshLogArchiveCacheEntry = (
  value: unknown,
  now = Date.now(),
): value is LogArchiveCacheEntry => {
  if (!value || typeof value != `object`) return false;
  const entry = value as Partial<LogArchiveCacheEntry>;
  return (
    entry.version == 1 &&
    typeof entry.cachedAt == `number` &&
    Number.isFinite(entry.cachedAt) &&
    typeof entry.expiresAt == `number` &&
    Number.isFinite(entry.expiresAt) &&
    entry.expiresAt > now &&
    typeof entry.name == `string` &&
    entry.data instanceof ArrayBuffer
  );
};

export const removeLogArchiveCache = async (url: string) => {
  try {
    await storage.removeItem(url);
  } catch {}
};

export const getLogArchiveCache = async (url: string) => {
  try {
    const entry = await storage.getItem<unknown>(url);
    if (isFreshLogArchiveCacheEntry(entry)) return entry;
    if (entry) await storage.removeItem(url);
  } catch {}
};

export const setLogArchiveCache = async (
  url: string,
  name: string,
  data: ArrayBuffer,
) => {
  const cachedAt = Date.now();
  try {
    const entries: Array<{ key: string; value: LogArchiveCacheEntry }> = [];
    for (const key of await storage.keys()) {
      const value = await storage.getItem<unknown>(key);
      if (!isFreshLogArchiveCacheEntry(value, cachedAt)) {
        await storage.removeItem(key);
      } else if (key != url) {
        entries.push({ key, value });
      }
    }
    entries.sort((a, b) => a.value.cachedAt - b.value.cachedAt);
    let totalSize = entries.reduce(
      (sum, entry) => sum + entry.value.data.byteLength,
      data.byteLength,
    );
    while (
      entries.length >= LOG_ARCHIVE_CACHE_MAX_ENTRIES ||
      totalSize > LOG_ARCHIVE_CACHE_MAX_SIZE
    ) {
      const oldest = entries.shift();
      if (!oldest) break;
      totalSize -= oldest.value.data.byteLength;
      await storage.removeItem(oldest.key);
    }
    await storage.setItem<LogArchiveCacheEntry>(url, {
      version: 1,
      cachedAt,
      expiresAt: cachedAt + LOG_ARCHIVE_CACHE_TTL,
      name,
      data,
    });
  } catch {}
};
