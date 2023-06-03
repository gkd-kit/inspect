import { shallowReactive, shallowRef } from 'vue';
import { delay } from './others';
import type { PrimitiveType } from './types';

export const useTask = <T extends (...args: any[]) => Promise<void>>(
  fn: T,
  miniInterval = 0,
  handler: (error: any) => void = () => {},
) => {
  const loadingRef = shallowRef(false);
  return {
    get loading() {
      return loadingRef.value;
    },
    invoke: async (...args: Parameters<T>) => {
      if (loadingRef.value) {
        return;
      }
      loadingRef.value = true;
      await fn(...args).catch((e) => {
        if (handler) {
          handler(e);
        } else {
          console.error(e);
        }
      });
      await delay(miniInterval);
      loadingRef.value = false;
    },
  };
};

export const useBatchTask = <T extends (...args: any[]) => Promise<void>>(
  fn: T,
  keyGetter: (...args: Parameters<T>) => PrimitiveType = (...args) =>
    args.join(``),
  miniInterval = 0,
  handler?: (error: any) => void,
) => {
  const loading = shallowReactive<Record<string, boolean>>({});
  const invoke = async (...args: Parameters<T>) => {
    const loadingKey = String(keyGetter(...args));
    if (loading[loadingKey]) {
      return;
    }
    loading[loadingKey] = true;
    await fn(...args).catch((e) => {
      if (handler) {
        handler(e);
      } else {
        console.error(e);
      }
    });
    await delay(miniInterval);
    delete loading[loadingKey];
  };
  return {
    loading,
    invoke,
  };
};
