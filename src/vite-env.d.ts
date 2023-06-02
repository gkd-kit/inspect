/// <reference types="vite/client" />

interface Window {
  __GmNetworkExtension: {
    GM_xmlhttpRequest: import('vite-plugin-monkey/dist/client').MonkeyWindow['GM_xmlhttpRequest'];
    GM_fetch: (
      input: RequestInfo | URL,
      init: RequestInit = {},
      xhrDetails: Partial<XhrRequest> = {},
    ) => Promise<Response>;
  };
}
