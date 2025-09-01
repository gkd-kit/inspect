import { GM_fetch, gmOk, type GmXhrOptions } from './gm';
import { isCanProxyImportFileUrl, isAllowCorsUrl } from './url';

const isGetReq = (req: Request, init?: RequestInit) => {
  return (init?.method || req.method).toUpperCase() === 'GET';
};

export const enhanceFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
): Promise<Response> => {
  const req = new Request(input);
  const u = new URL(req.url);
  if (import.meta.env.PROD && isAllowCorsUrl(u)) return fetch(input, init);
  if (gmOk()) {
    // with cookie
    // export snapshot need
    return GM_fetch(input, init, xhrDetails);
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
