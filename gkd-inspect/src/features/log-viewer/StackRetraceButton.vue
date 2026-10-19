<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui';

defineProps<{
  available?: boolean;
  loading?: boolean;
  stage?: string;
  retraced?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <NTooltip v-if="available" :disabled="!loading">
    <template #trigger>
      <span>
        <NButton
          size="small"
          secondary
          type="primary"
          :loading="loading"
          @click="emit('toggle')"
        >
          {{ retraced ? '原始堆栈' : '还原堆栈' }}
        </NButton>
      </span>
    </template>
    {{ stage || '正在准备还原堆栈' }}
  </NTooltip>
</template>
