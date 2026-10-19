export const isValidUrl = (url: string): URL | undefined => {
  try {
    return new URL(url);
  } catch {}
};

const corsOkOrigins = new Set([
  `https://cdn.jsdelivr.net`,
  `https://fastly.jsdelivr.net`,
  `https://raw.githubusercontent.com`,
  `https://gist.githubusercontent.com`,
  `https://raw.gitmirror.com`,
  `https://registry.npmmirror.com`,
]);

export const isAllowCorsUrl = (targetUrl: string | URL) => {
  targetUrl = new URL(targetUrl);
  if (typeof location !== 'undefined' && targetUrl.origin === location.origin) {
    return true;
  }
  if (targetUrl.hostname == `127.0.0.1` || targetUrl.hostname == `localhost`) {
    return true;
  }
  if (
    typeof location !== 'undefined' &&
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
