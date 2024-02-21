import type { Router } from 'vue-router';

const corsOkOrigins = new Set([
  location.origin,
  `https://cdn.jsdelivr.net`,
  `https://fastly.jsdelivr.net`,
  `https://raw.githubusercontent.com`,
  `https://gist.githubusercontent.com`,
  `https://raw.githubusercontents.com`,
  `https://raw.gitmirror.com`,
  `https://registry.npmmirror.com`,
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

export const githubZipUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/files\/([0-9]+)\/file\.zip$/;

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
        path: `/i/${zipAssetId}`,
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
