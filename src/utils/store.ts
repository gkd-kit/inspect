import { reactive } from 'vue';

const store = reactive({
  networkErrorDlgVisible: false,
  githubErrorDlgVisible: false,
  wasmErrorDlgVisible: false,
});

export default store;
