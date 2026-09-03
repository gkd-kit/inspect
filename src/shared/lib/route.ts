import type { LocationQuery } from 'vue-router';

export const filterQuery = (
  source: LocationQuery,
  keys: readonly string[],
): LocationQuery => {
  const result: LocationQuery = {};
  keys.forEach((key) => {
    const value = source[key];
    if (value !== undefined) result[key] = value;
  });
  return result;
};
