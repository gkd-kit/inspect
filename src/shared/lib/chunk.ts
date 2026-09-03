type loadAsyncType = (typeof import('jszip'))['loadAsync'];

export type JSZipType = typeof import('jszip');
export const JSZipAsync = import('jszip').then((r) => r.default);
export const loadAsync: loadAsyncType = async (data, options?) => {
  return import('jszip').then((r) => r.loadAsync(data, options));
};
