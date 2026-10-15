<script setup lang="ts">
defineProps<{
  available?: boolean;
  loading?: boolean;
  retraced?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <NButton
    v-if="available"
    size="small"
    secondary
    type="primary"
    :loading="loading"
    @click="emit('toggle')"
  >
    {{ retraced ? '原始堆栈' : '还原堆栈' }}
  </NButton>
</template>
