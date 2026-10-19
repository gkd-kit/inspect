export const WORKERS_API_ORIGIN = 'https://api.gkd.li';

const GITHUB_ORIGIN = 'https://github.com';
const GKD_FILE_ORIGIN = 'https://f.gkd.li';
const GITHUB_ATTACHMENT_PATHS = [
  /^\/user-attachments\/files\/([1-9][0-9]*)\/([^/]+)$/,
  /^\/gkd-kit\/inspect\/files\/([1-9][0-9]*)\/([^/]+)$/,
] as const;

const resolveProxyTargetUrl = (value: string | URL): URL | undefined => {
  let targetUrl: URL;
  try {
    targetUrl = new URL(value);
  } catch {
    return;
  }
  if (
    targetUrl.origin === GKD_FILE_ORIGIN &&
    !targetUrl.search &&
    !targetUrl.hash
  ) {
    const importId = targetUrl.pathname.match(/^\/([1-9][0-9]*)\/?$/)?.[1];
    if (!importId) return;
    return new URL(
      `/user-attachments/files/${importId}/file.zip`,
      GITHUB_ORIGIN,
    );
  }
  if (
    targetUrl.origin !== GITHUB_ORIGIN ||
    targetUrl.search ||
    targetUrl.hash
  ) {
    return;
  }
  const match = GITHUB_ATTACHMENT_PATHS.map((pattern) =>
    targetUrl.pathname.match(pattern),
  ).find((value) => value !== null);
  const filenameSegment = match?.[2];
  if (!filenameSegment) return;
  let filename: string;
  try {
    filename = decodeURIComponent(filenameSegment);
  } catch {
    return;
  }
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    /%(?:2f|5c|00)/i.test(filename) ||
    !filename.toLowerCase().endsWith('.zip')
  ) {
    return;
  }
  return targetUrl;
};

export const getWorkersProxyUrl = (
  targetUrl: string | URL,
): URL | undefined => {
  const resolvedTargetUrl = resolveProxyTargetUrl(targetUrl);
  if (!resolvedTargetUrl) return;
  const url = new URL('/proxy', WORKERS_API_ORIGIN);
  url.searchParams.set('url', String(resolvedTargetUrl));
  return url;
};
