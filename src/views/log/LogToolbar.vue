<script setup lang="ts">
import type { LogVersionInfo } from './source_links';

defineProps<{
  archiveLoading: boolean;
  inputUrl: string;
  logVersionInfo?: LogVersionInfo;
}>();

const emit = defineEmits<{
  files: [files: File[]];
  submit: [];
  'update:inputUrl': [value: string];
}>();

const localFileInput = shallowRef<HTMLInputElement>();
const openLocalFile = () => localFileInput.value?.click();
const handleLocalFile = () => {
  const input = localFileInput.value;
  if (!input) return;
  const files = [...(input.files || [])];
  input.value = ``;
  emit('files', files);
};

defineExpose({ openLocalFile });
</script>

<template>
  <div name="log-toolbar" class="h-42px flex items-center gap-10px">
    <RouterLink to="/" class="flex" title="首页">
      <NButton text style="--n-icon-size: 24px">
        <template #icon>
          <SvgIcon name="arrow" class="rotate-90" />
        </template>
      </NButton>
    </RouterLink>
    <div name="log-title" class="flex-none text-18px font-600">
      日志包查看器
    </div>
    <a
      v-if="logVersionInfo"
      :href="logVersionInfo.commitUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="flex-none text-14px text-[#2563eb] hover:underline"
    >
      {{ logVersionInfo.versionName }} ({{ logVersionInfo.versionCode }})
    </a>
    <NInputGroup class="ml-auto min-w-420px max-w-720px">
      <NInput
        :value="inputUrl"
        clearable
        placeholder="粘贴 GitHub、f.gkd.li 或其他 ZIP 链接"
        @update:value="emit('update:inputUrl', $event)"
        @keyup.enter="emit('submit')"
      />
      <NButton type="primary" :loading="archiveLoading" @click="emit('submit')">
        加载链接
      </NButton>
    </NInputGroup>
    <NButton :disabled="archiveLoading" @click="openLocalFile">
      选择本地 ZIP
    </NButton>
    <input
      ref="localFileInput"
      hidden
      type="file"
      accept=".zip,application/zip"
      @change="handleLocalFile"
    />
  </div>
</template>
