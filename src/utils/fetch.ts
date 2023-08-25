import { GM_fetch, gmOk } from './gm';
import store from './store';
import { isAllowCorsUrl } from './url';

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const u = new URL(new Request(input).url);
  if (isAllowCorsUrl(u)) return fetch(input, init);

  if (gmOk()) {
    // with cookie
    // export snapshot need
    return GM_fetch(input, init);
  } else {
    store.networkErrorDlgVisible = true;
    throw new Error(`gm is not supported`);
  }
};
