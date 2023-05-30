export const enhanceFetch = (async (...args) => {
  const f = window.__GmNetworkExtension?.GM_fetch ?? fetch;
  return f(...args);
}) as typeof fetch & {
  _enhanced: boolean;
};
Object.defineProperty(enhanceFetch, '_enhanced', {
  get() {
    return !!window.__GmNetworkExtension?.GM_fetch;
  },
});

export const GM_xmlhttpRequest: typeof window.__GmNetworkExtension.GM_xmlhttpRequest =
  (...args) => {
    return window.__GmNetworkExtension.GM_xmlhttpRequest(...args);
  };
