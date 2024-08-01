export interface GlobalStoreState {
  networkErrorDlgVisible: boolean;
  githubErrorDlgVisible: boolean;
  wasmErrorDlgVisible: boolean;
  wasmSupported?: boolean;
}

export const useGlobalStore = defineStore('global', {
  state(): GlobalStoreState {
    return {
      networkErrorDlgVisible: false,
      githubErrorDlgVisible: false,
      wasmErrorDlgVisible: false,
      wasmSupported: undefined,
    };
  },
});
