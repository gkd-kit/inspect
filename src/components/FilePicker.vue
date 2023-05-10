<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{ accept?: string }>(), {});
const emit = defineEmits<{
  (event: 'pickFiles', data: File[]): void;
}>();

const inputRef = ref<HTMLInputElement>();
const oninput = (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement)?.files ?? []);
  emit(`pickFiles`, files);
};

const showPicker = () => {
  inputRef.value?.click();
};
</script>
<template>
  <slot :showPicker="showPicker"></slot>
  <Teleport to="body">
    <input
      type="file"
      :accept="accept"
      ref="inputRef"
      v-show="false"
      @input="oninput"
    />
  </Teleport>
</template>
