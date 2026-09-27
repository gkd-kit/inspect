import { normalizeSourceUrl } from '../../entities/selector-library/sync.ts';

export const fetchSelectorLibrary = async (
  url: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const timeout = AbortSignal.timeout(20_000);
  try {
    const response = await fetch(normalizeSourceUrl(url), {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      credentials: 'omit',
      cache: 'no-cache',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(`读取失败：HTTP ${response.status}`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('链接返回的内容不是有效 JSON');
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error('读取超时，请稍后重试', { cause: error });
    if (error instanceof TypeError)
      throw new Error(
        '无法读取链接，请检查网络及来源是否允许跨域访问，也可以下载后从本地文件导入',
        { cause: error },
      );
    throw error;
  }
};
