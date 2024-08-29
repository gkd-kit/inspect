import { GM_fetch, gmOk } from './gm';
import { isAllowCorsUrl } from './url';
import { store } from '@/store';

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { proxy?: boolean },
) => {
  const req = new Request(input);
  const u = new URL(req.url);
  if (isAllowCorsUrl(u)) return fetch(input, { ...init, mode: 'cors' });

  if (gmOk()) {
    // with cookie
    // export snapshot need
    return GM_fetch(input, init);
  } else if (options?.proxy) {
    if (!u.href.startsWith('https://github.com/')) {
      store.networkErrorDlgVisible = true;
      throw new Error(`proxy is not supported`);
    }
    const proxyUrl = new URL(`https://proxy.gkd.li`);
    proxyUrl.searchParams.set(`proxyUrl`, u.href);
    const request = new Request(input, init);
    return fetch(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  } else {
    store.networkErrorDlgVisible = true;
    throw new Error(`gm is not supported`);
  }
};
