import { enhanceFetch } from '@/utils/fetch';
import type { LogSource } from '@/utils/log_url';
import { formatBytes, MAX_ZIP_SIZE } from './log';
import { readLimitedResponse } from './response';

const getResponseName = (response: Response, source: LogSource) => {
  const disposition = response.headers.get(`content-disposition`) || ``;
  const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = utf8Name || plainName;
  if (candidate) {
    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
  }
  if (source.name?.toLowerCase().endsWith(`.zip`)) return source.name;
  try {
    const finalName = new URL(response.url || source.url).pathname
      .split(`/`)
      .filter(Boolean)
      .at(-1);
    if (finalName) return decodeURIComponent(finalName);
  } catch {}
  return `log.zip`;
};

export const downloadLogArchive = async (
  source: LogSource,
  controller: AbortController,
) => {
  let downloadTooLarge = false;
  let response: Response;
  try {
    response = await enhanceFetch(
      source.url,
      { credentials: `omit`, signal: controller.signal },
      (details) => ({
        ...details,
        anonymous: true,
        onprogress(progress) {
          details.onprogress?.call(progress, progress);
          if (progress.loaded > MAX_ZIP_SIZE) {
            downloadTooLarge = true;
            controller.abort();
          }
        },
      }),
    );
  } catch (error) {
    if (downloadTooLarge) {
      throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`, {
        cause: error,
      });
    }
    throw error;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get(`content-length`) || 0);
  if (declaredSize > MAX_ZIP_SIZE) {
    throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`);
  }
  let data: ArrayBuffer;
  try {
    data = await readLimitedResponse(response, MAX_ZIP_SIZE);
  } catch (error) {
    if (error instanceof Error && error.message == `响应内容超过大小限制`) {
      throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`, {
        cause: error,
      });
    }
    throw error;
  }
  return { data, name: getResponseName(response, source) };
};
