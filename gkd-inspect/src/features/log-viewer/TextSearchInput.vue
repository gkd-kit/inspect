<script setup lang="ts">
import { isTextSearchQueryValid } from './text_search';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    size?: `tiny` | `small` | `medium` | `large`;
  }>(),
  {
    placeholder: `搜索`,
    size: `medium`,
  },
);

const query = defineModel<string>({ required: true });
const matchCase = defineModel<boolean>(`matchCase`, { default: false });
const wholeWord = defineModel<boolean>(`wholeWord`, { default: false });
const useRegex = defineModel<boolean>(`useRegex`, { default: false });
const invalidRegex = computed(() => {
  return !isTextSearchQueryValid(query.value, {
    matchCase: matchCase.value,
    wholeWord: wholeWord.value,
    useRegex: useRegex.value,
  });
});
</script>

<template>
  <div name="text-search" class="w-full min-w-0 flex items-center gap-6px">
    <NInput
      v-model:value="query"
      clearable
      :size="props.size"
      :status="invalidRegex ? 'error' : undefined"
      :placeholder="props.placeholder"
      class="min-w-0 flex-1"
    >
      <template #suffix>
        <div name="text-search-options" class="flex items-center gap-2px">
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              matchCase
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="matchCase"
            aria-label="区分大小写"
            title="区分大小写"
            @mousedown.prevent
            @click="matchCase = !matchCase"
          >
            Aa
          </button>
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px underline [text-underline-offset:2px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              wholeWord
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="wholeWord"
            aria-label="全词匹配"
            title="全词匹配"
            @mousedown.prevent
            @click="wholeWord = !wholeWord"
          >
            ab
          </button>
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              useRegex
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="useRegex"
            aria-label="使用正则表达式"
            title="使用正则表达式"
            @mousedown.prevent
            @click="useRegex = !useRegex"
          >
            .*
          </button>
        </div>
      </template>
    </NInput>
  </div>
</template>
