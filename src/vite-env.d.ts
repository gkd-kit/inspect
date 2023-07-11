/// <reference types="vite/client" />

interface Window {
  __GmNetworkExtension: {
    GM_info: import('vite-plugin-monkey/dist/client').MonkeyWindow['GM_info'];
    GM_xmlhttpRequest: import('vite-plugin-monkey/dist/client').MonkeyWindow['GM_xmlhttpRequest'];
  };
}

declare module 'virtual:commit' {
  type DefaultLogFields = import('simple-git').DefaultLogFields;
  type ListLogLine = import('simple-git').ListLogLine;
  const latestLog: DefaultLogFields & ListLogLine;
  export default latestLog;
}
