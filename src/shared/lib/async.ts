export const delay = async (milliseconds = 0) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const DELETE_TIMEOUT = 12_000;

export const withTimeout = <T>(
  task: () => Promise<T>,
  milliseconds: number,
  message = '操作超时',
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    task().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};
