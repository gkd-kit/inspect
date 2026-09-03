<script setup lang="ts">
import { dateZhCN, zhCN, type GlobalThemeOverrides } from 'naive-ui';
import { RouterView } from 'vue-router';
import ErrorDlg from './components/app/ErrorDlg.vue';
import { useTheme } from './composables/useTheme';
import { ScrollbarWrapper } from './utils/others';
import { debounce } from 'lodash-es';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    lineHeight: '20px',
  },
};

const { appTheme } = useTheme();

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
    :dateLocale="dateZhCN"
    :theme="appTheme"
    :themeOverrides="themeOverrides"
  >
    <ErrorDlg />
    <RouterView />
  </NConfigProvider>
  <ScrollbarWrapper />
</template>
