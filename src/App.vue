<script setup lang="ts">
import { NConfigProvider, dateZhCN, zhCN } from 'naive-ui';
import { RouterView } from 'vue-router';
import ErrorDlg from './components/ErrorDlg.vue';
</script>
<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" abstract>
    <ErrorDlg />
    <RouterView />
  </NConfigProvider>
</template>
<style lang="scss">
:root {
  --gkd-height: max(700px, 100vh);
}
#app {
  min-width: 1200px;
  min-height: 700px;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  &.mobile {
    min-width: auto;
  }
}
.gkd_code {
  font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace !important;
}

[direction-rtl],
.direction-rtl {
  direction: rtl;
}
</style>
