<script setup lang="ts">
import type { SelectorSyntaxDiagnostic } from './selector_diagnostics';

const props = defineProps<{
  diagnostic: SelectorSyntaxDiagnostic;
}>();

const errorText = computed(() => {
  const diagnostic = props.diagnostic;
  if (diagnostic.status != 'invalid') return '';
  const position =
    diagnostic.index == null ? '' : ` · 位置 ${diagnostic.index + 1}`;
  return `语法错误${position}：${diagnostic.message}`;
});
</script>

<template>
  <span
    v-if="diagnostic.status == 'invalid'"
    role="alert"
    class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-11px leading-22px text-[#d03050]"
    :title="errorText"
  >
    {{ errorText }}
  </span>
</template>
