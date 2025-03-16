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
#app {
  display: flex;
  flex-direction: column;
  height: var(--gkd-h);
  &.app-auto-h {
    --gkd-h: auto;
  }
}
</style>
