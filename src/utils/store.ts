import { shallowReactive } from 'vue';

const store = shallowReactive({
  networkErrorDlgVisible: false,
  githubErrorDlgVisible: false,
  wasmErrorDlgVisible: false,
  wasmSupported: undefined as boolean | undefined,
});

export default store;
