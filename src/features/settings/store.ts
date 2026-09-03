import type { SettingsStore } from '@/features/settings/types';
import { loadLocalStorage } from '@/shared/storage/browserStorage';

const createDefaultSettings = (): SettingsStore => ({
  autoUploadImport: false,
  ignoreUploadWarn: false,
  maxShowNodeSize: 2000,
  themeMode: 'system',
});

const settingsData = loadLocalStorage<SettingsStore>(
  'settings',
  createDefaultSettings,
  (value: any) => ({
    ...createDefaultSettings(),
    ...value,
    themeMode:
      value?.themeMode == 'light' || value?.themeMode == 'dark'
        ? value.themeMode
        : 'system',
  }),
);

export const settingsStore = readonly(settingsData) as Readonly<SettingsStore>;

export const settingsActions = {
  update(patch: Partial<SettingsStore>) {
    Object.assign(settingsData, patch);
    localStorage.setItem('settings', JSON.stringify(toRaw(settingsData)));
  },
};
