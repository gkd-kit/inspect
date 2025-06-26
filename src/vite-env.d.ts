/// <reference types="vite/client" />

interface Window {
  __NetworkExtension__: {
    GM_info: import('vite-plugin-monkey/dist/client').MonkeyWindow['GM_info'];
    GM_xmlhttpRequest: import('vite-plugin-monkey/dist/client').MonkeyWindow['GM_xmlhttpRequest'];
  };
}
