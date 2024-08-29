export interface GlobalStoreState {
  networkErrorDlgVisible: boolean;
  githubErrorDlgVisible: boolean;
  wasmErrorDlgVisible: boolean;
  wasmSupported?: boolean;
}

export const store = shallowReactive<GlobalStoreState>({
  networkErrorDlgVisible: false,
  githubErrorDlgVisible: false,
  wasmErrorDlgVisible: false,
  wasmSupported: undefined,
});
