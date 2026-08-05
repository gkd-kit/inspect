<script setup lang="ts">
import { useTextViewerState } from './context';

const {
  query,
  searchOptions,
  searchPlaceholder,
  normalizedQuery,
  matchCount,
  displayedResultIndex,
  invalidRegex,
  selectRelativeResult,
  handleSearchEnter,
} = useTextViewerState();
</script>

<template>
  <div
    name="text-viewer-search"
    class="w-520px max-w-full min-w-0 flex flex-[0_1_520px] items-center gap-6px"
  >
    <div
      name="text-viewer-navigation"
      class="w-116px min-w-116px flex items-center justify-between gap-2px"
      :class="normalizedQuery ? 'visible' : 'invisible'"
    >
      <span
        class="w-62px overflow-hidden text-right text-ellipsis whitespace-nowrap text-12px text-[#64748b]"
        :title="`第 ${displayedResultIndex.toLocaleString()} 处，共 ${matchCount.toLocaleString()} 处`"
      >
        {{ displayedResultIndex.toLocaleString() }} /
        {{ matchCount.toLocaleString() }}
      </span>
      <button
        type="button"
        class="inline-grid h-22px w-24px cursor-pointer place-items-center rounded-3px border-0 bg-transparent p-0 leading-22px text-[#475569] enabled:hover:bg-[#e2e8f0] disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
        :disabled="!matchCount"
        aria-label="上一个匹配项"
        title="上一个匹配项 (Shift+Enter)"
        @mousedown.prevent
        @click="selectRelativeResult(-1)"
      >
        <SvgIcon name="arrow" class="h-16px w-16px rotate-180" />
      </button>
      <button
        type="button"
        class="inline-grid h-22px w-24px cursor-pointer place-items-center rounded-3px border-0 bg-transparent p-0 leading-22px text-[#475569] enabled:hover:bg-[#e2e8f0] disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
        :disabled="!matchCount"
        aria-label="下一个匹配项"
        title="下一个匹配项 (Enter)"
        @mousedown.prevent
        @click="selectRelativeResult(1)"
      >
        <SvgIcon name="arrow" class="h-16px w-16px" />
      </button>
    </div>
    <NInput
      v-model:value="query"
      clearable
      size="small"
      :status="invalidRegex ? 'error' : undefined"
      :placeholder="searchPlaceholder"
      class="min-w-0 flex-1"
      @keydown.enter.prevent="handleSearchEnter"
    >
      <template #suffix>
        <div
          name="text-viewer-search-options"
          class="flex items-center gap-2px"
        >
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              searchOptions.matchCase
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="searchOptions.matchCase"
            aria-label="区分大小写"
            title="区分大小写"
            @mousedown.prevent
            @click="searchOptions.matchCase = !searchOptions.matchCase"
          >
            Aa
          </button>
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px underline [text-underline-offset:2px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              searchOptions.wholeWord
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="searchOptions.wholeWord"
            aria-label="全词匹配"
            title="全词匹配"
            @mousedown.prevent
            @click="searchOptions.wholeWord = !searchOptions.wholeWord"
          >
            ab
          </button>
          <button
            type="button"
            class="inline-grid h-22px w-26px cursor-pointer place-items-center rounded-3px border-0 p-0 font-mono text-12px leading-22px focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :class="
              searchOptions.useRegex
                ? 'bg-[#dbeafe] text-[#1d4ed8]'
                : 'bg-transparent text-[#475569] hover:bg-[#e2e8f0]'
            "
            :aria-pressed="searchOptions.useRegex"
            aria-label="使用正则表达式"
            title="使用正则表达式"
            @mousedown.prevent
            @click="searchOptions.useRegex = !searchOptions.useRegex"
          >
            .*
          </button>
        </div>
      </template>
    </NInput>
  </div>
</template>
