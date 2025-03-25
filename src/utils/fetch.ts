import { GM_fetch, gmOk } from './gm';
import { isCanProxyImportFileUrl, isAllowCorsUrl } from './url';

const isGetReq = (req: Request, init?: RequestInit) => {
  return (init?.method || req.method).toUpperCase() === 'GET';
};

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const req = new Request(input);
  const u = new URL(req.url);
  if (isAllowCorsUrl(u)) return fetch(input, init);
  if (gmOk()) {
    // with cookie
    // export snapshot need
    return GM_fetch(input, init);
  } else if (isGetReq(req, init) && isCanProxyImportFileUrl(u.href)) {
    const proxyUrl = new URL(`https://proxy.gkd.li`);
    proxyUrl.searchParams.set(`proxyUrl`, u.href);
    const request = new Request(input, init);
    return fetch(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  } else {
    useGlobalStore().networkErrorDlgVisible = true;
    throw new Error(`gm is not supported`);
  }
};
