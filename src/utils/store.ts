import { reactive } from 'vue';

const store = reactive({
  networkErrorDlgVisible: false,
  githubErrorDlgVisible: false,
  wasmErrorDlgVisible: false,
  wasmSupported: undefined as boolean | undefined,
});

export default store;
