import router from '@/router';

const corsOkOrigins = new Set([
  location.origin,
  `https://cdn.jsdelivr.net`,
  `https://fastly.jsdelivr.net`,
  `https://raw.githubusercontent.com`,
  `https://raw.githubusercontents.com`,
  `https://raw.gitmirror.com`,
]);

export const isAllowCorsUrl = (u: string | URL) => {
  u = new URL(u);
  if (
    location.protocol == `http:` &&
    u.protocol == `http:` &&
    u.hostname.split(`.`).every((s) => Number.isSafeInteger(parseInt(s))) // is ip host
  ) {
    return true;
  }
  return corsOkOrigins.has(u.origin);
};

// https://github.com/gkd-kit/inspect/files/12448138/file.zip -> /import/12448138
export const githubZipUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/files\/([0-9]+)\/file\.zip$/;

// https://github.com/gkd-kit/inspect/assets/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a -> /import/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a
export const githubPngUrlReg =
  /^https:\/\/github\.com\/gkd-kit\/inspect\/assets\/([0-9]+)\/([0-9a-z\-]+)$/;

export const githubUrlToSelfUrl = (u: string | URL): string => {
  u = u.toString();
  let href: string;
  const { 1: zipAssetId } = u.match(githubZipUrlReg) || [];
  const { 1: userId, 2: pngAssetId } = u.match(githubPngUrlReg) || [];
  if (zipAssetId) {
    href = router.resolve({
      path: `/import/${zipAssetId}`,
    }).href;
  } else if (userId && pngAssetId) {
    href = router.resolve({
      path: `/import/${userId}/${pngAssetId}`,
    }).href;
  } else {
    throw new Error(
      `github url ${u} should come from gkd-kit/inspect files/assets`,
    );
  }
  return location.origin + href;
};
