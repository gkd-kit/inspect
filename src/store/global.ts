export const useGlobalStore = createGlobalState(() => {
  return shallowReactive<GlobalStore>({
    networkErrorDlgVisible: false,
    githubErrorDlgVisible: false,
  }) as GlobalStore;
});
