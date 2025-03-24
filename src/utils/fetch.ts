import { GM_fetch, gmOk } from './gm';
import { isAllowCorsUrl } from './url';

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const req = new Request(input);
  const u = new URL(req.url);
  if (isAllowCorsUrl(u)) return fetch(input, init);
  if (gmOk()) {
    // with cookie
    // export snapshot need
    return GM_fetch(input, init);
  } else {
    useGlobalStore().networkErrorDlgVisible = true;
    throw new Error(`gm is not supported`);
  }
};
