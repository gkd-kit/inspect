import { message } from '@/utils/discrete';

export const errorWrap = <T>(
  getter: () => T,
  catchHandler?: ((e: unknown) => unknown) | string,
  finallyHandler?: () => void,
) => {
  try {
    return getter();
  } catch (e) {
    if (typeof catchHandler == 'string') {
      message.error(catchHandler);
    } else {
      const error = catchHandler?.(e) ?? e;
      if (typeof error == 'string') {
        message.error(error);
      } else if (error instanceof Error) {
        message.error(error.message);
      }
    }
    throw e;
  } finally {
    finallyHandler?.();
  }
};

export const errorTry = <T extends (...args: any[]) => any>(fn: T) => {
  return (...args: Parameters<T>) => {
    try {
      fn(...args);
    } catch {}
  };
};
