import { delay } from './others';
import { headers2obj } from './others';

export const GM_xmlhttpRequest: typeof window.__GmNetworkExtension.GM_xmlhttpRequest =
  (...args) => {
    return window.__GmNetworkExtension?.GM_xmlhttpRequest(...args);
  };

const scriptHandler = () => {
  return window.__GmNetworkExtension?.GM_info?.scriptHandler;
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

/**
 * https://github.com/github/fetch/blob/9a6d748b394a2c16b250262fcaf46afd5364b415/fetch.js#L555
 */
const fixUrl = (url = '') => {
  try {
    return url === '' && location.href ? location.href : url;
  } catch {
    return url;
  }
};

const reverseForm = (formData: FormData): FormData => {
  const reversedForm = new FormData();
  const reversedList: [string, FormDataEntryValue][] = [];
  formData.forEach((v, k) => {
    reversedList.push([k, v]);
  });
  reversedList.reverse().forEach(([k, v]) => {
    reversedForm.append(k, v);
  });
  return reversedForm;
};

const compatForm = (formData: FormData, headers: Headers) => {
  if (scriptHandler() == `Tampermonkey`) {
    // https://github.com/Tampermonkey/tampermonkey/issues/1783
    headers.delete(`content-type`);
    return reverseForm(formData);
  }
  return formData;
};

type XhrRequest = import('vite-plugin-monkey/dist/client').XhrRequest;

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
  xhrDetails: Partial<XhrRequest> | ((arg: XhrRequest) => XhrRequest) = {},
): Promise<Response> => {
  const request = new Request(input, init);
  if (request.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const method = request.method.toUpperCase();
  const url = fixUrl(request.url);

  // headers
  const sendHeaders = new Headers(request.headers);
  new Headers(init.headers).forEach((value, key) => {
    sendHeaders.set(key, value);
  });

  let binary = false;
  let data: FormData | Blob | string | undefined = undefined;

  if (method != 'GET') {
    if (init.body) {
      if (init.body instanceof FormData) {
        data = compatForm(init.body, sendHeaders);
      } else if (
        typeof init.body == 'string' ||
        init.body instanceof URLSearchParams
      ) {
        data = init.body;
      } else {
        binary = true;
        data = await request.blob();
      }
    } else {
      const formData = await request
        .clone()
        .formData()
        .catch(() => {});
      if (formData) {
        data = compatForm(formData, sendHeaders);
      }
    }
  }

  return new Promise<Response>((resolve, reject) => {
    let initXhrDetails: XhrRequest = {
      method,
      url,
      headers: headers2obj(sendHeaders),
      data,
      binary,
      responseType: 'blob',
      async onload(e) {
        let body: BodyInit | null | undefined = undefined;
        if (!(e.response instanceof Blob && e.response.size == 0)) {
          // Response': Response with null body status cannot have body
          body = e.response ?? e.responseText;
        }
        await delay();
        const resp = new Response(body, {
          status: e.status,
          statusText: e.statusText,
          headers: parseHeaders(e.responseHeaders),
        });
        Object.defineProperty(resp, 'url', { value: e.finalUrl });
        resolve(resp);
      },
      async onerror() {
        await delay();
        reject(new TypeError('Network request onerror failed'));
      },
      async ontimeout() {
        await delay();
        reject(new TypeError('Network request ontimeout failed'));
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
    };
    if (typeof xhrDetails == 'function') {
      initXhrDetails = xhrDetails(initXhrDetails);
    } else {
      initXhrDetails = { ...initXhrDetails, ...xhrDetails };
    }
    const handle = GM_xmlhttpRequest(initXhrDetails);
    function abortXhr() {
      handle.abort();
    }
    request.signal?.addEventListener('abort', abortXhr);
  });
};
