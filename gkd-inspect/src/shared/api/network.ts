import { GM_fetch, gmOk, type GmXhrOptions } from './gm';
import { getWorkersProxyUrl } from './workers_proxy';
import { isAllowCorsUrl } from '../lib/url';

export const networkFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
): Promise<Response> => {
  const request = new Request(input, init);
  request.signal.throwIfAborted();
  if (import.meta.env.PROD && isAllowCorsUrl(request.url)) {
    return fetch(input, init);
  }
  if (gmOk()) {
    return GM_fetch(input, init, (details) => {
      const configured = xhrDetails ? xhrDetails(details) : details;
      return request.credentials === 'omit'
        ? { ...configured, anonymous: true }
        : configured;
    });
  }
  const proxyUrl = request.method === 'GET' && getWorkersProxyUrl(request.url);
  if (proxyUrl) {
    return fetch(proxyUrl, {
      ...init,
      method: request.method,
      headers: request.headers,
      signal: request.signal,
      credentials: 'omit',
    });
  }
  return fetch(input, init);
};
