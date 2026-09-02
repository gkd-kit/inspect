export const useGlobalStore = createGlobalState(() => {
  const state = shallowReactive<GlobalStore>({
    networkErrorDlgVisible: false,
    githubErrorDlgVisible: false,
  });
  const setNetworkErrorDialogVisible = (visible: boolean) => {
    state.networkErrorDlgVisible = visible;
  };
  const setGithubErrorDialogVisible = (visible: boolean) => {
    state.githubErrorDlgVisible = visible;
  };
  return {
    state: readonly(state),
    setNetworkErrorDialogVisible,
    setGithubErrorDialogVisible,
  };
});
