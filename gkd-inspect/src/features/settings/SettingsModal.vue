<script setup lang="ts">
import { settingsActions, settingsStore } from './store';
import { useTheme } from '@/features/settings/useTheme';

defineProps<{ show: boolean }>();

const emit = defineEmits<{
  'update:show': [show: boolean];
}>();

const { setThemeMode, themeMode } = useTheme();
const themeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];
const closeSettings = () => emit('update:show', false);
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="设置"
    :maskClosable="false"
    :showIcon="false"
    positiveText="关闭"
    style="width: 600px"
    @positiveClick="closeSettings"
    @close="closeSettings"
    @esc="closeSettings"
    @update:show="emit('update:show', $event)"
  >
    <div flex items-center justify-between gap-24px>
      <span>外观主题</span>
      <NSelect
        :value="themeMode"
        :options="themeOptions"
        class="w-140px shrink-0"
        @update:value="setThemeMode"
      />
    </div>
    <div class="app-divider" />
    <div flex items-center justify-between gap-24px>
      <span>关闭生成分享链接弹窗提醒</span>
      <NSwitch
        :value="settingsStore.ignoreUploadWarn"
        aria-label="关闭生成分享链接弹窗提醒"
        class="shrink-0"
        @update:value="settingsActions.update({ ignoreUploadWarn: $event })"
      />
    </div>
    <div class="app-divider" />
    <div flex items-center justify-between gap-24px>
      <span>打开快照页面自动生成分享链接（请确保不含隐私）</span>
      <NSwitch
        :value="settingsStore.autoUploadImport"
        aria-label="打开快照页面自动生成分享链接"
        class="shrink-0"
        @update:value="settingsActions.update({ autoUploadImport: $event })"
      />
    </div>
  </NModal>
</template>
