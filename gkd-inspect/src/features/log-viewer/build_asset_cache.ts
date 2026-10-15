import localforage from 'localforage';

export const BUILD_ASSET_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export const BUILD_ASSET_CACHE_MAX_ENTRIES = 10;
export const BUILD_ASSET_CACHE_MAX_SIZE = 200 * 1024 * 1024;

export type BuildAssetCacheEntry = {
  version: 1;
  assetId: number;
  cachedAt: number;
  expiresAt: number;
  data: ArrayBuffer;
};

const storage = localforage.createInstance({
  name: `gkd-inspect-log`,
  storeName: `build_assets`,
  version: 1,
  driver: localforage.INDEXEDDB,
});

export const isFreshBuildAssetCacheEntry = (
  value: unknown,
  now = Date.now(),
): value is BuildAssetCacheEntry => {
  if (!value || typeof value != `object`) return false;
  const entry = value as Partial<BuildAssetCacheEntry>;
  return (
    entry.version == 1 &&
    typeof entry.assetId == `number` &&
    Number.isSafeInteger(entry.assetId) &&
    entry.assetId > 0 &&
    typeof entry.cachedAt == `number` &&
    Number.isFinite(entry.cachedAt) &&
    typeof entry.expiresAt == `number` &&
    Number.isFinite(entry.expiresAt) &&
    entry.expiresAt > now &&
    entry.data instanceof ArrayBuffer
  );
};

const getCacheKey = (assetId: number) => String(assetId);

export const removeBuildAssetCache = async (assetId: number) => {
  try {
    await storage.removeItem(getCacheKey(assetId));
  } catch {}
};

export const getBuildAssetCache = async (assetId: number) => {
  const key = getCacheKey(assetId);
  try {
    const entry = await storage.getItem<unknown>(key);
    if (isFreshBuildAssetCacheEntry(entry) && entry.assetId == assetId) {
      return entry;
    }
    if (entry) await storage.removeItem(key);
  } catch {}
};

export const setBuildAssetCache = async (
  assetId: number,
  data: ArrayBuffer,
) => {
  const cachedAt = Date.now();
  try {
    const entries: Array<{ key: string; value: BuildAssetCacheEntry }> = [];
    for (const key of await storage.keys()) {
      const value = await storage.getItem<unknown>(key);
      if (!isFreshBuildAssetCacheEntry(value, cachedAt)) {
        await storage.removeItem(key);
      } else if (key != getCacheKey(assetId)) {
        entries.push({ key, value });
      }
    }
    entries.sort((a, b) => a.value.cachedAt - b.value.cachedAt);
    let totalSize = entries.reduce(
      (sum, entry) => sum + entry.value.data.byteLength,
      data.byteLength,
    );
    while (
      entries.length >= BUILD_ASSET_CACHE_MAX_ENTRIES ||
      totalSize > BUILD_ASSET_CACHE_MAX_SIZE
    ) {
      const oldest = entries.shift();
      if (!oldest) break;
      totalSize -= oldest.value.data.byteLength;
      await storage.removeItem(oldest.key);
    }
    await storage.setItem<BuildAssetCacheEntry>(getCacheKey(assetId), {
      version: 1,
      assetId,
      cachedAt,
      expiresAt: cachedAt + BUILD_ASSET_CACHE_TTL,
      data,
    });
  } catch {}
};
