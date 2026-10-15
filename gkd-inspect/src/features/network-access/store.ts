interface NetworkAccessState {
  networkErrorDialogVisible: boolean;
  githubErrorDialogVisible: boolean;
}

export const useNetworkAccessStore = createGlobalState(() => {
  const state = shallowReactive<NetworkAccessState>({
    networkErrorDialogVisible: false,
    githubErrorDialogVisible: false,
  });
  const setNetworkErrorDialogVisible = (visible: boolean) => {
    state.networkErrorDialogVisible = visible;
  };
  const setGithubErrorDialogVisible = (visible: boolean) => {
    state.githubErrorDialogVisible = visible;
  };
  return {
    state: readonly(state),
    setNetworkErrorDialogVisible,
    setGithubErrorDialogVisible,
  };
});
