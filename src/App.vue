<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView />
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
  .code-text {
    font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace;
  }
}
</style>
