export const useGlobalStore = createGlobalState(() => {
  return shallowReactive<GlobalStore>({
    networkErrorDlgVisible: false,
    githubErrorDlgVisible: false,
    wasmErrorDlgVisible: false,
    wasmSupported: undefined as boolean | undefined,
  }) as GlobalStore;
});
