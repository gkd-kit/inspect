export const useGlobalStore = defineStore('global', () => {
  const networkErrorDlgVisible = shallowRef(false);
  const githubErrorDlgVisible = shallowRef(false);
  const wasmErrorDlgVisible = shallowRef(false);
  const wasmSupported = shallowRef<boolean>();

  return {
    networkErrorDlgVisible,
    githubErrorDlgVisible,
    wasmErrorDlgVisible,
    wasmSupported,
  };
});
