<script setup lang="ts">
import { dateZhCN, zhCN, type GlobalThemeOverrides } from 'naive-ui';
import { RouterView } from 'vue-router';
import { debounce } from 'lodash-es';
import AppErrorDialog from './ui/AppErrorDialog.vue';
import AppScrollbar from './ui/AppScrollbar.vue';
import { useTheme } from '@/features/settings/useTheme';

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
    <AppErrorDialog />
    <RouterView />
  </NConfigProvider>
  <AppScrollbar />
</template>
