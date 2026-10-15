export const obj2form = (...objects: Record<string, unknown>[]) => {
  const formData = new FormData();
  objects.forEach((object) => {
    for (const key in object) {
      const value = object[key];
      if (value === undefined) continue;
      if (value instanceof File) formData.append(key, value, value.name);
      else if (value instanceof Blob) formData.append(key, value);
      else formData.append(key, String(value));
    }
  });
  return formData;
};

export const obj2usp = (...objects: Record<string, unknown>[]) => {
  const searchParams = new URLSearchParams();
  objects.forEach((object) => {
    for (const key in object) {
      const value = object[key];
      if (value !== undefined) searchParams.append(key, String(value));
    }
  });
  return searchParams;
};

export const headers2obj = (headers: Headers) => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};
