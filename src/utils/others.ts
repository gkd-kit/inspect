import { onMounted, onUnmounted } from 'vue';
import { message } from './discrete';
import root from './root';
import type { LocationQuery } from 'vue-router';

export const obj2form = (...objs: Record<string, unknown>[]) => {
  const fd = new FormData();
  objs.forEach((obj) => {
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) continue;
      if (v instanceof File) {
        fd.append(k, v, v.name);
      } else if (v instanceof Blob) {
        fd.append(k, v);
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
  return async (text: string) => {
    if (lastText === text) return;
    lastText = text;
    delay(10_000).then(() => {
      lastText = void 0;
    });
    try {
      await navigator.clipboard.writeText(text);
      message.success(`复制成功`);
    } catch {
      message.error(`复制失败`);
    }
  };
})();

export const useAdaptMobile = () => {
  const isMobile = window.innerHeight > window.innerWidth;
  onMounted(() => {
    if (isMobile) {
      root.classList.add('mobile');
    }
  });
  onUnmounted(() => {
    root.classList.remove('mobile');
  });
};

export const timeAgo = (date: number) => {
  const seconds = Math.floor((Date.now() - date) / 1000);
  const interval = Math.floor(seconds / 31536000);

  if (interval >= 1) {
    return `${interval} 年前`;
  }

  const months = Math.floor(seconds / 2592000);
  if (months >= 1) {
    return `${months} 月前`;
  }

  const days = Math.floor(seconds / 86400);
  if (days >= 1) {
    return `${days} 天前`;
  }

  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) {
    return `${hours} 小时前`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) {
    return `${minutes} 分钟前`;
  }

  return `刚刚`;
};

const emptyFn = () => {};
export const buildEmptyFn = () => emptyFn;

export const filterQuery = (
  obj: LocationQuery,
  keys: string[],
): LocationQuery => {
  const newObj: LocationQuery = {};
  keys.forEach((k) => {
    const value = obj[k];
    if (value !== undefined) {
      newObj[k] = value;
    }
  });
  return newObj;
};
