import type { LocationQuery } from 'vue-router';
import { message } from './discrete';
import root from './root';
import { Teleport } from 'vue';
import BodyScrollbar from '@/components/BodyScrollbar.vue';

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
  return async (text?: string) => {
    if (!text) return;
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

const useAutoCls = (el: Element, cls: string) => {
  el.classList.add(cls);
  onMounted(() => {
    el.classList.add(cls);
  });
  onUnmounted(() => {
    el.classList.remove(cls);
  });
};

export const useAutoHeight = () => {
  useAutoCls(root, 'app-auto-h');
};

export const useAutoWidth = () => {
  useAutoCls(document.body, 'body-auto-w');
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

export const isIntString = (v: string | number | undefined) => {
  if (typeof v === 'number') return true;
  return (
    typeof v === 'string' &&
    Array.prototype.every.call(v, (c) => '0' <= c && c <= '9')
  );
};

export const toInteger = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isSafeInteger(v)) {
    return v;
  }
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isSafeInteger(n)) {
      return n;
    }
  }
};

export const ScrollbarWrapper = defineComponent(() => {
  const show = shallowRef(false);
  const isMobile = 'ontouchstart' in document.documentElement;
  show.value = !isMobile;
  if (isMobile) {
    document.body.classList.add('mobile');
    document.documentElement.classList.add('mobile');
  }
  return () => {
    return show.value
      ? h(Teleport, { to: document.body }, h(BodyScrollbar))
      : undefined;
  };
});

// https://github.com/alan-turing-institute/distinctipy
export const colorList = [
  '#ff00ff',
  '#18821c',
  '#00ff00',
  '#007fff',
  '#ff7f00',
  '#7fbf7f',
  '#4e01bf',
  '#b80836',
  '#d67ffd',
  '#00ffff',
  '#fafe43',
  '#00ff7f',
  '#215b8f',
  '#bd667c',
  '#84f7f8',
  '#8dfa01',
  '#8f6605',
  '#f5bc95',
  '#a631f6',
  '#21bab7',
  '#4b1e4a',
  '#7578c8',
  '#c1b629',
  '#ff007f',
  '#0000ff',
  '#4cc62a',
  '#00007f',
  '#fd404b',
  '#b6fc97',
  '#f742d8',
  '#373fea',
  '#a31b90',
  '#ff0000',
  '#03ae66',
  '#a1b6e3',
  '#61f9a8',
];
