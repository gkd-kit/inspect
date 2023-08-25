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
