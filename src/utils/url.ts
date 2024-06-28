const corsOkOrigins = new Set([
  location.origin,
  `https://cdn.jsdelivr.net`,
  `https://fastly.jsdelivr.net`,
  `https://raw.githubusercontent.com`,
  `https://gist.githubusercontent.com`,
  `https://raw.gitmirror.com`,
  `https://registry.npmmirror.com`,
  'https://detect.gkd.li',
]);

export const isAllowCorsUrl = (targetUrl: string | URL) => {
  targetUrl = new URL(targetUrl);
  if (targetUrl.hostname == `127.0.0.1` || targetUrl.hostname == `localhost`) {
    return true;
  }
  if (
    location.protocol == `http:` &&
    targetUrl.protocol == `http:` &&
    targetUrl.hostname
      .split(`.`)
      .every((s) => Number.isSafeInteger(parseInt(s))) // is ip host
  ) {
    return true;
  }
  return corsOkOrigins.has(targetUrl.origin);
};

const urlRegList = [
  /^https:\/\/f\.gkd\.li\/(\d+)$/,
  /^https:\/\/github\.com\/gkd-kit\/inspect\/files\/(\d+)\/file\.zip$/,
  /^https:\/\/github\.com\/user-attachments\/files\/(\d+)\/file\.zip$/,
  /^https:\/\/i\.gkd\.li\/i\/(\d+)$/,
  /^https:\/\/i\.gkd\.li\/import\/(\d+)$/,
];

export const getImportId = (url: string) => {
  if (typeof url !== 'string') return;
  if (url.startsWith(location.origin)) {
    const importId = +new URL(url).pathname.substring(1);
    if (Number.isSafeInteger(importId) && importId > 0) {
      return importId;
    }
  }
  for (const reg of urlRegList) {
    const id = url.match(reg)?.[1];
    if (id) {
      return +id;
    }
  }
};

export const getImportUrl = (importId: number | string) => {
  return location.origin + `/i/${importId}`;
};

export const getImportFileUrl = (importId: number | string) => {
  return `https://github.com/user-attachments/files/${importId}/file.zip`;
};

export const githubImageUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/assets\/([0-9]+)\/([0-9a-z-]+)$/;

export const githubUrlToSelfUrl = (u: string): string => {
  const { 1: userId, 2: imgAssetId } = u.match(githubImageUrlReg) || [];
  if (userId && imgAssetId) {
    return `https://m.gkd.li/${userId}/${imgAssetId}`;
  } else {
    throw new Error(
      `github url ${u} should come from gkd-kit/inspect files/assets`,
    );
  }
};

export const isValidUrl = (url: string): URL | undefined => {
  try {
    return new URL(url);
  } catch {}
};
