import { message } from './discrete';

export const obj2form = (...objs: Record<string, unknown>[]) => {
  const fd = new FormData();
  objs.forEach((obj) => {
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) continue;
      if (v instanceof Blob) {
        fd.append(k, v, v.name);
      } else {
        fd.append(k, String(v));
      }
    }
  });
  return fd;
};

export function obj2usp(...objs: Record<string, unknown>[]) {
  const usp = new URLSearchParams();
  objs.forEach((obj) => {
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) continue;
      usp.append(k, String(v));
    }
  });
  return usp;
}

export const headers2obj = (headers: Headers) => {
  const h: Record<string, string> = {};
  headers.forEach((v, k) => {
    h[k] = v;
  });
  return h;
};

export const delay = async (n = 0) => {
  return new Promise<void>((res) => {
    setTimeout(res, n);
  });
};

export const copy = (() => {
  let lastText: string | void = void 0;
  return async (text = ``) => {
    if (lastText === text) return;
    lastText = text;
    delay(10_000).then(() => {
      lastText = void 0;
    });
    await navigator.clipboard.writeText(text);
    message.success(`复制成功`);
  };
})();
