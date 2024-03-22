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
  --gkd-width: max(1200px, 100vw);
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
    --gkd-width: 100vw;
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

.box-shadow-dim,
[box-shadow-dim] {
  box-shadow:
    rgba(0, 0, 0, 0.2) 0px 11px 15px -7px,
    rgba(0, 0, 0, 0.14) 0px 24px 38px 3px,
    rgba(0, 0, 0, 0.12) 0px 9px 46px 8px;
}
</style>
