import { GM_fetch, gmOk } from './gm';
import store from './store';

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    direct?: boolean;
    proxy?: boolean;
    gm?: boolean;
  },
) => {
  if (options?.gm) {
    if (gmOk()) {
      // with cookie
      // export snapshot need
      return GM_fetch(input, init);
    }
    store.shareErrorDlgVisible = true;
    throw new Error(`gm is not supported`);
  }
  if (options?.proxy) {
    const u = new URL(new Request(input).url);
    const proxyUrl = new URL(`https://proxy-workers.lisonge.workers.dev/`);
    proxyUrl.searchParams.set(`proxyUrl`, u.href);
    const request = new Request(input, init);
    return fetch(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  }
  return fetch(input, init);
};
