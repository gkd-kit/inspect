import { message } from '@/utils/discrete';

export const errorWrap = <T>(
  getter: () => T,
  catchHandler?: (e: unknown) => unknown,
  finallyHandler?: () => void,
) => {
  try {
    return getter();
  } catch (e) {
    const error = catchHandler?.(e) ?? e;
    if (typeof error == 'string') {
      message.error(error);
    } else if (error instanceof Error) {
      message.error(error.message);
    }
    throw e;
  } finally {
    finallyHandler?.();
  }
};
