<script setup lang="ts">
import { NInput } from 'naive-ui';
import { computed, shallowRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';

import SelectorText from '@/entities/selector/ui/SelectorText.vue';
import {
  inspectSelectorSyntax,
  getSelectorErrorHighlightSegments,
} from '@/entities/selector/diagnostics';
import PageBackButton from '@/features/navigation/PageBackButton.vue';
import * as base64url from 'universal-base64url';

const route = useRoute();
const router = useRouter();

const getTextFromRoute = (value: unknown) => {
  const t = String(value || '');
  if (!t) return t;
  try {
    return base64url.decode(t);
  } catch {
    return '';
  }
};
const setTextToRoute = async (value: string) => {
  await router.replace({
    query: { gkd: value ? base64url.encode(value) : undefined },
  });
};

const initialText = getTextFromRoute(route.query.gkd);
const inputText = shallowRef(initialText);
const text = shallowRef(initialText.trim());
let inputRevision = 0;
const applyInputText = useDebounceFn(
  async (revision: number, value: string) => {
    if (revision != inputRevision) return;
    text.value = value.trim();
    await setTextToRoute(text.value);
  },
  500,
);
const updateInputText = (value: string) => {
  inputText.value = value;
  void applyInputText(++inputRevision, value);
};
const loadTextFromRoute = (value: unknown) => {
  const nextText = getTextFromRoute(value);
  if (nextText == inputText.value && nextText.trim() == text.value) return;
  inputRevision += 1;
  inputText.value = nextText;
  text.value = nextText.trim();
};
onBeforeRouteUpdate((to) => loadTextFromRoute(to.query.gkd));
const diagnostic = computed(() => inspectSelectorSyntax(text.value));
const error = computed(() => {
  const result = diagnostic.value;
  if (result.status !== 'invalid') return;
  const segments = getSelectorErrorHighlightSegments(text.value, result);
  return { message: result.message, segments };
});
</script>
<template>
  <div class="flex items-center gap-[16px] pt-[12px] px-[12px]">
    <PageBackButton />
    <div class="flex gap-[16px] items-center">
      <div class="text-[18px]">测试选择器</div>
      <div>语法高亮/错误解析</div>
    </div>
  </div>
  <div class="flex flex-col items-center p-[8px] text-[40px]/[52px]">
    <NInput
      :value="inputText"
      type="textarea"
      placeholder="请输入选择器"
      class="font-mono! py-[4px]"
      style="--n-font-size: 20px; --n-line-height-textarea: 28px"
      :autosize="{
        minRows: 3,
        maxRows: 8,
      }"
      @update:value="updateInputText"
    />
    <div class="h-[20px]" />
    <div
      class="max-w-full mb-[8px] p-[4px] font-mono! transition-colors"
      :class="error ? `bg-red-200` : `bg-[oklch(96.32%_0.0034_247.86)]`"
    >
      <div class="overflow-x-auto">
        <SelectorText :source="text" />
      </div>
      <div
        v-if="error?.segments"
        class="text-[16px] leading-[24px] whitespace-pre-wrap"
      >
        <span>{{ error.segments.before }}</span
        ><span class="bg-red-300"
          >{{ error.segments.error
          }}<span
            v-if="error.segments.eof"
            class="inline-block w-[2px] h-[1em] bg-red-500" /></span
        ><span>{{ error.segments.after }}</span>
      </div>
    </div>
    <div v-if="error" class="p-[4px] bg-red-300 font-mono!">
      {{ error.message }}
    </div>
  </div>
</template>
