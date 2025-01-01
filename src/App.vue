<script setup lang="ts">
import { dateZhCN, zhCN } from 'naive-ui';
import { RouterView } from 'vue-router';
import ErrorDlg from './components/ErrorDlg.vue';
import { ScrollbarWrapper } from './utils/others';
</script>
<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" abstract>
    <ErrorDlg />
    <RouterView />
  </NConfigProvider>
  <ScrollbarWrapper />
</template>
<style lang="scss">
$winMinWidth: 1200px;
$winMinHeight: 700px;

:root {
  --gkd-w: max(#{$winMinWidth}, 100vw);
  --gkd-h: max(#{$winMinHeight}, 100vh);
}

body {
  width: var(--gkd-w);
  &.body-auto-w {
    --gkd-w: 100vw;
  }
}

#app {
  display: flex;
  flex-direction: column;
  height: var(--gkd-h);
  &.app-auto-h {
    --gkd-h: auto;
  }
}
.gkd_code,
[gkd_code] {
  font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace !important;
}

[direction-rtl],
.direction-rtl {
  direction: rtl;
}

.box-shadow-dim,
[box-shadow-dim] {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 6px 16px 0 rgba(0, 0, 0, 0.08),
    0 9px 28px 8px rgba(0, 0, 0, 0.05);
}
@media (prefers-color-scheme: dark) {
  .box-shadow-dim,
  [box-shadow-dim] {
    box-shadow:
      0 3px 6px -4px rgba(0, 0, 0, 0.24),
      0 6px 12px 0 rgba(0, 0, 0, 0.16),
      0 9px 18px 8px rgba(0, 0, 0, 0.1);
  }
}

// 移除 inline 元素的空白间隙
img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block;
}

.scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
