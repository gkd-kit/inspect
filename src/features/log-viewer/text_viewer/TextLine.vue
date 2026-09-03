<script setup lang="tsx">
import type { VirtualTextLine } from '../virtual_text';
import { type TextLineFragment, useTextViewerState } from './context';

const props = defineProps<{
  line: VirtualTextLine;
}>();

const { wrap, getLineTokens, setActiveMatchElement } = useTextViewerState();
const tokens = computed(() => getLineTokens(props.line));

const HighlightedText = (props: { fragments: readonly TextLineFragment[] }) => (
  <>
    {props.fragments.map((fragment, index) =>
      fragment.match ? (
        <span
          key={index}
          ref={fragment.active ? setActiveMatchElement : undefined}
          data-name="text-viewer-match"
          data-active={fragment.active ? `` : undefined}
          class={[
            `rounded-2px text-inherit`,
            fragment.active ? `bg-[#fb923c] text-[#7c2d12]` : `bg-[#fde68a]`,
          ]}
        >
          {fragment.text}
        </span>
      ) : (
        fragment.text
      ),
    )}
  </>
);

const activatePopover = (event: KeyboardEvent) => {
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.click();
};
</script>

<template>
  <div
    name="text-viewer-line"
    class="grid min-h-20px min-w-full leading-20px"
    :class="
      wrap
        ? 'w-full grid-cols-[64px_minmax(0,1fr)]'
        : 'w-max grid-cols-[64px_max-content]'
    "
  >
    <span
      class="sticky left-0 z-1 box-border select-none border-r border-[#e5e7eb] bg-[#f8fafc] px-10px text-right text-[#94a3b8]"
    >
      {{ line.number }}
    </span>
    <span
      class="box-border min-w-0 px-10px [font:inherit] [tab-size:2]"
      :class="
        wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre'
      "
    >
      <template v-for="(token, index) in tokens" :key="index">
        <a
          v-if="token.sourceTargets?.length == 1"
          :href="token.sourceTargets[0]?.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[#2563eb] underline decoration-transparent underline-offset-2 hover:decoration-current"
        >
          <HighlightedText :fragments="token.fragments" />
        </a>
        <NPopover
          v-else-if="token.sourceTargets && token.sourceTargets.length > 1"
          trigger="click"
          placement="bottom-start"
        >
          <template #trigger>
            <span
              role="button"
              tabindex="0"
              class="cursor-pointer text-[#2563eb] underline decoration-dashed underline-offset-2"
              @keydown.enter.prevent="activatePopover"
              @keydown.space.prevent="activatePopover"
            >
              <HighlightedText :fragments="token.fragments" />
            </span>
          </template>
          <div class="max-w-640px flex flex-col gap-4px">
            <a
              v-for="target in token.sourceTargets"
              :key="target.path"
              :href="target.url"
              :title="target.path"
              target="_blank"
              rel="noopener noreferrer"
              class="break-all text-[#2563eb] hover:underline"
            >
              {{ target.displayPath }}
            </a>
          </div>
        </NPopover>
        <HighlightedText v-else :fragments="token.fragments" />
      </template>
    </span>
  </div>
</template>
