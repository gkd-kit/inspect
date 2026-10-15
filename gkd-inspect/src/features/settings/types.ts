export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsStore {
  autoUploadImport: boolean;
  ignoreUploadWarn: boolean;
  maxShowNodeSize: number;
  themeMode: ThemeMode;
}
