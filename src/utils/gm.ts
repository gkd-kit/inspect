import { delay } from './others';
import { headers2obj } from './others';

export const GM_xmlhttpRequest: typeof window.__GmNetworkExtension.GM_xmlhttpRequest =
  (...args) => {
    return window.__GmNetworkExtension?.GM_xmlhttpRequest(...args);
  };

export const gmOk = () => {
  return !!window.__GmNetworkExtension?.GM_xmlhttpRequest;
};

/**
 * https://github.com/github/fetch/blob/fb5b0cf42b470faf8c5448ab461d561f34380a30/fetch.js#L422
 */
export const parseHeaders = (rawHeaders = '') => {
  const headers = new Headers();
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
  // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
  // https://github.com/github/fetch/issues/748
  // https://github.com/zloirock/core-js/issues/751
  preProcessedHeaders
    .split('\r')
    .map(function (header) {
      return header.startsWith(`\n`) ? header.substring(1) : header;
    })
    .forEach(function (line) {
      let parts = line.split(':');
      let key = parts.shift()?.trim();
      if (key) {
        let value = parts.join(':').trim();
        headers.append(key, value);
      }
    });
  return headers;
};

// https://github.com/github/fetch/blob/master/fetch.js

const fixUrl = (url = '') => {
  try {
    return url === '' && location.href ? location.href : url;
  } catch {
    return url;
  }
};

/**
 * simulate window.fetch with GM_xmlhttpRequest
 *
 * because [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) will delete [Forbidden_header_name](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name)
 *
 * so you must manually modify these headers by set the second parameter of GM_fetch
 * @example
 * GM_fetch(
 *   new Request('https://www.pixiv.net/', {
 *     headers: { referer: 'https://www.pixiv.net/' }, // it will not work !!!
 *   }),
 * );
 * GM_fetch(new Request('https://www.pixiv.net/'), {
 *   headers: { referer: 'https://www.pixiv.net/' }, // it will work
 *   headers: new Headers({ referer: 'https://www.pixiv.net/' }), // it will also work
 * });
 */
export const GM_fetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  xhrDetails: Partial<import('vite-plugin-monkey/dist/client').XhrRequest> = {},
): Promise<Response> => {
  const request = new Request(input, init);
  if (request.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  let binary = false;
  const sendHeaders = new Headers(request.headers);
  new Headers(init.headers).forEach((value, key) => {
    sendHeaders.set(key, value);
  });
  let data: FormData | Blob | string | undefined = undefined;
  if (init.body instanceof FormData) {
    data = init.body;
    sendHeaders.delete(`content-type`);
  } else if (typeof init.body == 'string') {
    data = init.body;
  } else {
    binary = true;
    data = await request.blob();
  }
  return new Promise<Response>((resolve, reject) => {
    const handle = GM_xmlhttpRequest({
      ...xhrDetails,
      method: request.method.toUpperCase(),
      url: fixUrl(request.url),
      headers: headers2obj(sendHeaders),
      data,
      binary,
      responseType: 'blob',
      async onload(e) {
        await delay();
        const resp = new Response(e.response ?? e.responseText, {
          status: e.status,
          statusText: e.statusText,
          headers: parseHeaders(e.responseHeaders),
        });
        Object.defineProperty(resp, 'url', { value: e.finalUrl });
        resolve(resp);
      },
      async onerror() {
        await delay();
        reject(new TypeError('Network request failed'));
      },
      async ontimeout() {
        await delay();
        reject(new TypeError('Network request failed'));
      },
      async onabort() {
        await delay();
        reject(new DOMException('Aborted', 'AbortError'));
      },
      async onreadystatechange(response) {
        if (response.readyState === 4) {
          request.signal?.removeEventListener('abort', abortXhr);
        }
      },
    });
    function abortXhr() {
      handle.abort();
    }
    request.signal?.addEventListener('abort', abortXhr);
  });
};
