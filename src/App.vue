<script setup lang="ts">
import { RouterView } from 'vue-router';
import { NConfigProvider, zhCN, dateZhCN } from 'naive-ui';
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
