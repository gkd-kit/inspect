import type { ThemeMode } from '@/features/settings/types';
import { settingsActions, settingsStore } from './store';
import { createSharedComposable } from '@vueuse/core';
import { darkTheme } from 'naive-ui';

const isThemeMode = (value: unknown): value is ThemeMode =>
  value == 'system' || value == 'light' || value == 'dark';

export const useTheme = createSharedComposable(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const systemDark = shallowRef(media.matches);
  const themeMode = computed(() => settingsStore.themeMode);
  const isDark = computed(
    () =>
      themeMode.value == 'dark' ||
      (themeMode.value == 'system' && systemDark.value),
  );
  const appTheme = computed(() => (isDark.value ? darkTheme : null));

  const applyDocumentTheme = () => {
    document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark.value
      ? 'dark'
      : 'light';
  };

  const updateSystemTheme = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches;
    applyDocumentTheme();
  };

  const setThemeMode = (value: unknown) => {
    if (!isThemeMode(value)) return;
    settingsActions.update({ themeMode: value });
    applyDocumentTheme();
  };

  applyDocumentTheme();
  onMounted(() => media.addEventListener('change', updateSystemTheme));
  onBeforeUnmount(() => media.removeEventListener('change', updateSystemTheme));

  return {
    appTheme,
    isDark,
    setThemeMode,
    themeMode,
  };
});
