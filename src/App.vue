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
import { showShareError } from '@/utils/dialog';
import store from './utils/store';

let shareErrorDlg: DialogReactive | undefined = undefined;
watchEffect(() => {
  shareErrorDlg?.destroy();
  if (store.shareErrorDlgVisible) {
    shareErrorDlg = showShareError();
  } else {
    shareErrorDlg = undefined;
  }
});
onUnmounted(() => {
  shareErrorDlg?.destroy();
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
