<script setup lang="ts">
import { RouterView } from 'vue-router';
import {
  NConfigProvider,
  zhCN,
  dateZhCN,
  NDialog,
  DialogReactive,
} from 'naive-ui';
import { onUnmounted, watchEffect } from 'vue';
import { showNetworkError, showGithubError } from '@/utils/dialog';
import store from './utils/store';

let networkErrorDlg: DialogReactive | undefined = undefined;
watchEffect(() => {
  networkErrorDlg?.destroy();
  if (store.networkErrorDlgVisible) {
    networkErrorDlg = showNetworkError();
  } else {
    networkErrorDlg = undefined;
  }
});
onUnmounted(() => {
  networkErrorDlg?.destroy();
});
let githubErrorDlg: DialogReactive | undefined = undefined;
watchEffect(() => {
  githubErrorDlg?.destroy();
  if (store.githubErrorDlgVisible) {
    githubErrorDlg = showGithubError();
  } else {
    githubErrorDlg = undefined;
  }
});
onUnmounted(() => {
  githubErrorDlg?.destroy();
});
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" abstract>
    <RouterView />
  </NConfigProvider>
</template>

<style scoped lang="scss"></style>
<style lang="scss">
#app {
  min-width: 1200px;
  min-height: 700px;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}
.gkd_code {
  font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace;
}
</style>
