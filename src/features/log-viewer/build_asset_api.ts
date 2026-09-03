import {
  requestWorkersJson,
  WORKERS_API_ORIGIN,
} from '../../shared/api/workers.ts';

interface BuildAsset {
  assetId: number;
}

export const getBuildAsset = async (
  buildKey: string,
  signal?: AbortSignal,
): Promise<BuildAsset | null> => {
  const url = new URL('/build-asset/getBuildAsset', WORKERS_API_ORIGIN);
  url.searchParams.set('buildKey', buildKey);
  const result = await requestWorkersJson<BuildAsset | null>(url, { signal });
  if (
    result != null &&
    (!Number.isSafeInteger(result.assetId) || result.assetId <= 0)
  ) {
    throw new Error(`Workers API returned an invalid build asset ID`);
  }
  return result;
};
