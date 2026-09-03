export type JsonTableRow = {
  key: string;
  value: unknown;
};

export const MAX_STRUCTURED_JSON_ENTRIES = 10_000;
export const MAX_STRUCTURED_JSON_TREE_ENTRIES = 100_000;
export const MAX_STRUCTURED_JSON_DEPTH = 128;
export const MAX_STRUCTURED_JSON_PATH_SIZE = 4096;
export const MAX_STRUCTURED_JSON_KEY_SIZE = 256;

export const getJsonEntryCount = (value: unknown) => {
  if (typeof value != `object` || value == null) return 0;
  if (Array.isArray(value)) {
    return value.length <= MAX_STRUCTURED_JSON_ENTRIES
      ? value.length
      : undefined;
  }
  let count = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    count++;
    if (count > MAX_STRUCTURED_JSON_ENTRIES) return;
  }
  return count;
};

export const isJsonStructureTooLarge = (value: unknown) => {
  return (
    typeof value == `object` &&
    value != null &&
    getJsonEntryCount(value) == null
  );
};

export const isJsonTreeTooLarge = (value: unknown) => {
  if (typeof value != `object` || value == null) return false;
  const pending: Array<{ value: object; depth: number; pathSize: number }> = [
    { value, depth: 0, pathSize: 0 },
  ];
  const visited = new WeakSet<object>();
  let entryCount = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current || visited.has(current.value)) continue;
    if (current.depth >= MAX_STRUCTURED_JSON_DEPTH) return true;
    visited.add(current.value);
    if (Array.isArray(current.value)) {
      entryCount += current.value.length;
      if (entryCount > MAX_STRUCTURED_JSON_TREE_ENTRIES) return true;
      for (let index = 0; index < current.value.length; index++) {
        const child = current.value[index];
        const pathSize = current.pathSize + String(index).length + 1;
        if (pathSize > MAX_STRUCTURED_JSON_PATH_SIZE) return true;
        if (typeof child == `object` && child != null) {
          pending.push({
            value: child,
            depth: current.depth + 1,
            pathSize,
          });
        }
      }
      continue;
    }
    for (const key in current.value) {
      if (!Object.hasOwn(current.value, key)) continue;
      if (key.length > MAX_STRUCTURED_JSON_KEY_SIZE) return true;
      entryCount++;
      if (entryCount > MAX_STRUCTURED_JSON_TREE_ENTRIES) return true;
      const pathSize = current.pathSize + key.length + 1;
      if (pathSize > MAX_STRUCTURED_JSON_PATH_SIZE) return true;
      const child = (current.value as Record<string, unknown>)[key];
      if (typeof child == `object` && child != null) {
        pending.push({
          value: child,
          depth: current.depth + 1,
          pathSize,
        });
      }
    }
  }
  return false;
};

const isJsonPrimitive = (value: unknown) => {
  return (
    value == null ||
    typeof value == `string` ||
    typeof value == `number` ||
    typeof value == `boolean`
  );
};

export const isBasicJsonValue = (value: unknown) => {
  if (isJsonPrimitive(value)) return true;
  if (Array.isArray(value)) return value.every(isJsonPrimitive);
  return (
    typeof value == `object` && value != null && Object.keys(value).length == 0
  );
};

export const getBasicJsonTableRows = (
  value: unknown,
): JsonTableRow[] | undefined => {
  if (typeof value != `object` || value == null) return;
  if (isJsonStructureTooLarge(value)) return;
  const entries = Object.entries(value);
  if (
    entries.length == 0 ||
    !entries.every(([, item]) => isBasicJsonValue(item))
  ) {
    return;
  }
  return entries.map(([key, item]) => ({ key, value: item }));
};

export const formatBasicJsonValue = (value: unknown) => {
  return JSON.stringify(value) ?? String(value);
};

export const formatJsonForPreview = (value: unknown, raw: string) => {
  if (isJsonTreeTooLarge(value)) return raw;
  try {
    return JSON.stringify(value, null, 2) ?? raw;
  } catch {
    return raw;
  }
};
