import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router';

const GITHUB_ORIGIN = `https://github.com`;
const GKD_FILE_ORIGIN = `https://f.gkd.li`;

export type LogSource = {
  url: string;
  name?: string;
};

const getQueryString = (value: unknown) => {
  if (Array.isArray(value)) value = value[0];
  return typeof value == 'string' ? value.trim() : ``;
};

const toHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol == `http:` || url.protocol == `https:`) return url;
  } catch {}
};

const getGithubParts = (url: URL) => {
  if (url.origin != GITHUB_ORIGIN || url.search || url.hash) return;
  const match = url.pathname.match(
    /^\/user-attachments\/files\/(\d+)\/([^/]+\.zip)$/i,
  );
  if (!match) return;
  const assetId = match[1];
  let filename: string;
  try {
    filename = decodeURIComponent(match[2]);
  } catch {
    return;
  }
  if (!assetId || !filename || filename.includes(`/`)) return;
  return { assetId, filename };
};

const getShortcutId = (url: URL) => {
  if (url.origin != GKD_FILE_ORIGIN || url.search || url.hash) return;
  return url.pathname.match(/^\/(\d+)\/?$/)?.[1];
};

export const getKnownLogRoute = (
  value: string,
): RouteLocationRaw | undefined => {
  const url = toHttpUrl(value);
  if (!url) return;
  const github = getGithubParts(url);
  if (github) {
    return {
      path: `/log/${github.assetId}/${encodeURIComponent(github.filename)}`,
    };
  }
  const shortcutId = getShortcutId(url);
  if (shortcutId) return { path: `/log/${shortcutId}` };
};

export const getLogRoute = (value: string): RouteLocationRaw | undefined => {
  const url = toHttpUrl(value);
  if (!url) return;
  return (
    getKnownLogRoute(url.href) || {
      path: `/log`,
      query: { url: url.href } satisfies LocationQueryRaw,
    }
  );
};

export const getLogPathSource = (pathMatch: unknown): LogSource | undefined => {
  const parts = Array.isArray(pathMatch)
    ? pathMatch.map(String)
    : typeof pathMatch == 'string'
      ? pathMatch.split(`/`).filter(Boolean)
      : [];
  if (parts.length == 1 && /^\d+$/.test(parts[0])) {
    return {
      url: `${GKD_FILE_ORIGIN}/${parts[0]}`,
      name: `log-${parts[0]}.zip`,
    };
  }
  if (
    parts.length == 2 &&
    /^\d+$/.test(parts[0]) &&
    /^[^/]+\.zip$/i.test(parts[1])
  ) {
    const filename = parts[1];
    return {
      url: `${GITHUB_ORIGIN}/user-attachments/files/${parts[0]}/${encodeURIComponent(filename)}`,
      name: filename,
    };
  }
};

export const getLogQuerySource = (queryUrl: unknown): LogSource | undefined => {
  const value = getQueryString(queryUrl);
  const url = value && toHttpUrl(value);
  if (!url) return;
  const pathname = url.pathname.split(`/`).filter(Boolean).at(-1);
  let name: string | undefined;
  if (pathname) {
    try {
      name = decodeURIComponent(pathname);
    } catch {}
  }
  return { url: url.href, name };
};

export const isValidLogPath = (pathMatch: unknown) => {
  return !!getLogPathSource(pathMatch);
};
