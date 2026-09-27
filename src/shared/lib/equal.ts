const isPrimitive = (value: unknown): boolean =>
  value === null || typeof value !== 'object';

export function isJsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (isPrimitive(left) || isPrimitive(right)) {
    return (
      typeof left === 'number' &&
      typeof right === 'number' &&
      Number.isNaN(left) &&
      Number.isNaN(right)
    );
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isJsonEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  let matchedRightKeyCount = 0;
  for (const key of leftKeys) {
    const rightHasKey = Object.hasOwn(rightRecord, key);
    if (rightHasKey) {
      matchedRightKeyCount += 1;
    }
    if (
      !isJsonEqual(leftRecord[key], rightHasKey ? rightRecord[key] : undefined)
    ) {
      return false;
    }
  }
  if (matchedRightKeyCount === rightKeys.length) {
    return true;
  }
  for (const key of rightKeys) {
    if (
      !Object.hasOwn(leftRecord, key) &&
      !isJsonEqual(undefined, rightRecord[key])
    ) {
      return false;
    }
  }
  return true;
}
