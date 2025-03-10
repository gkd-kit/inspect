<script setup lang="ts">
import { dateZhCN, zhCN, type GlobalThemeOverrides } from 'naive-ui';
import { RouterView } from 'vue-router';
import ErrorDlg from './components/ErrorDlg.vue';
import { ScrollbarWrapper } from './utils/others';
import { debounce } from 'lodash-es';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    lineHeight: '20px',
  },
};

const freeActiveElement = debounce(() => {
  if (document.activeElement instanceof HTMLButtonElement) {
    document.activeElement.blur();
  }
}, 1000);
useEventListener('click', () => {
  freeActiveElement();
});
</script>
<template>
  <NConfigProvider
    abstract
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
  >
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
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace !important;
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

.scrollbar-hidden,
[scrollbar-hidden] {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

html,
body,
#app {
  /* 禁止 iOS/Edge 滚动回弹效果 */
  overscroll-behavior: none;
}

html,
body {
  font-size: 14px;
  line-height: 20px;
}
</style>
