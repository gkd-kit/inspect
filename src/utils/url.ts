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
  return corsOkOrigins.has(new URL(u).origin);
};
const assetsBaseUrl = `https://github.com/gkd-kit/inspect/assets/`;
const filesBaseUrl = `https://github.com/gkd-kit/inspect/files/`;
export const githubUrlToSelfUrl = (u: string | URL): string => {
  // https://github.com/gkd-kit/inspect/files/12448138/file.zip -> /import/12448138
  // https://github.com/gkd-kit/inspect/assets/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a -> /import/38517192/83fc7e58-8b8e-4114-a897-3e7bb7d8c45a
  u = u.toString();
  let href: string;
  if (u.startsWith(assetsBaseUrl)) {
    href = router.resolve({
      path: `/import/` + u.substring(assetsBaseUrl.length),
    }).href;
  } else if (u.startsWith(filesBaseUrl)) {
    href = router.resolve({
      path: `/import/` + u.substring(filesBaseUrl.length).split(`/`)[0],
    }).href;
  } else {
    throw new Error(
      `github url ${u} should come from gkd-kit/inspect files/assets`,
    );
  }
  return location.origin + href;
};
