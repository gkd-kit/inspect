import type { Router } from 'vue-router';

const corsOkOrigins = new Set([
  location.origin,
  `https://cdn.jsdelivr.net`,
  `https://fastly.jsdelivr.net`,
  `https://raw.githubusercontent.com`,
  `https://raw.githubusercontents.com`,
  `https://raw.gitmirror.com`,
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

// https://github.com/gkd-kit/inspect/files/12448138/file.zip -> /import/12448138
export const githubZipUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/files\/([0-9]+)\/file\.zip$/;

// https://github.com/gkd-kit/inspect/assets/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a -> /import/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a
export const githubImageUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/assets\/([0-9]+)\/([0-9a-z-]+)$/;

export const githubUrlToSelfUrl = (router: Router, u: string | URL): string => {
  u = u.toString();
  const { 1: zipAssetId } = u.match(githubZipUrlReg) || [];
  const { 1: userId, 2: imgAssetId } = u.match(githubImageUrlReg) || [];
  if (zipAssetId) {
    return (
      location.origin +
      router.resolve({
        path: `/import/${zipAssetId}`,
      }).href
    );
  } else if (userId && imgAssetId) {
    return `https://m.gkd.li/${userId}/${imgAssetId}`;
  } else {
    throw new Error(
      `github url ${u} should come from gkd-kit/inspect files/assets`,
    );
  }
};
