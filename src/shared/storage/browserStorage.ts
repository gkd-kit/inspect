import localforage from 'localforage';

const directReturn = <T>(value: T): T => value;

const tryRun = <T>(task: () => T, fallback: () => T): T => {
  try {
    return task();
  } catch {
    return fallback();
  }
};

export const loadLocalStorage = <T extends object>(
  key: string,
  fallback: () => T,
  parse: (value: unknown) => T = directReturn as (value: unknown) => T,
): T => {
  const source = localStorage.getItem(key);
  const initialValue = source
    ? tryRun(() => parse(JSON.parse(source)), fallback)
    : fallback();
  return shallowReactive(initialValue) as T;
};

export const loadIndexedStorage = async <T extends object>(
  key: string,
  fallback: () => T,
  parse: (value: any) => T = directReturn,
): Promise<T> => {
  const initialValue = await localforage.getItem(key);
  return shallowReactive(initialValue ? parse(initialValue) : fallback()) as T;
};

const persistRecord = (key: string, value: object) => {
  void localforage.setItem(key, toRaw(value));
};

export const setStoredRecordValue = <T>(
  record: Record<string, T>,
  storageKey: string,
  key: string | number,
  value: T | undefined,
) => {
  const normalizedKey = String(key);
  if (value === undefined) delete record[normalizedKey];
  else record[normalizedKey] = value;
  persistRecord(storageKey, record);
};
