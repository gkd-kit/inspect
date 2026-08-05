import type { VirtualListInst } from 'naive-ui';
import type { ComponentPublicInstance, Ref } from 'vue';
import { createInjectionState, useResizeObserver } from '@vueuse/core';
import { message } from '@/utils/discrete';
import {
  countTextLineMatches,
  createTextSearchOptions,
  getTextMatchRanges,
  isTextSearchQueryValid,
} from '../text_search';
import { getVirtualTextLines, type VirtualTextLine } from '../virtual_text';

type TextViewerOptions = {
  value: Readonly<Ref<string>>;
  searchPlaceholder: Readonly<Ref<string>>;
  allowWrap: Readonly<Ref<boolean>>;
  copyable: Readonly<Ref<boolean>>;
};

export type TextLineSegment = {
  text: string;
  match: boolean;
  active: boolean;
};

const [provideTextViewerState, injectTextViewerState] = createInjectionState(
  (options: TextViewerOptions) => {
    const query = shallowRef(``);
    const resultIndex = shallowRef(-1);
    const searchOptions = reactive(createTextSearchOptions());
    const wrap = shallowRef(false);
    const virtualList = shallowRef<VirtualListInst>();
    const scrollContainer = shallowRef<HTMLElement>();
    const scrollTop = shallowRef(0);
    const viewportHeight = shallowRef(600);
    const activeMatch = shallowRef<{
      lineKey: number;
      rangeIndex: number;
    }>();
    const activeMatchElement = shallowRef<HTMLElement>();
    const lineHeight = 20;
    const overscan = 8;

    const lines = computed(() => getVirtualTextLines(options.value.value));
    const normalizedQuery = computed(() => query.value.trim());
    const matchCount = computed(() =>
      countTextLineMatches(options.value.value, query.value, searchOptions),
    );
    const displayedResultIndex = computed(() => {
      if (!matchCount.value) return 0;
      return Math.min(Math.max(resultIndex.value, 0), matchCount.value - 1) + 1;
    });
    const invalidRegex = computed(
      () => !isTextSearchQueryValid(query.value, searchOptions),
    );
    const visibleStart = computed(() => {
      return Math.max(Math.floor(scrollTop.value / lineHeight) - overscan, 0);
    });
    const visibleEnd = computed(() => {
      return Math.min(
        Math.ceil((scrollTop.value + viewportHeight.value) / lineHeight) +
          overscan,
        lines.value.length,
      );
    });
    const visibleLines = computed(() => {
      return lines.value.slice(visibleStart.value, visibleEnd.value);
    });
    const virtualHeight = computed(() => lines.value.length * lineHeight);

    useResizeObserver(scrollContainer, (entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) viewportHeight.value = height;
    });

    const selectRelativeResult = (offset: number) => {
      if (!normalizedQuery.value || !matchCount.value) return;
      const current = resultIndex.value >= 0 ? resultIndex.value : 0;
      resultIndex.value =
        (current + offset + matchCount.value) % matchCount.value;
    };

    const handleSearchEnter = (event: KeyboardEvent) => {
      selectRelativeResult(event.shiftKey ? -1 : 1);
    };

    const handleScroll = () => {
      scrollTop.value = scrollContainer.value?.scrollTop || 0;
    };

    const setActiveMatchElement = (
      element: Element | ComponentPublicInstance | null,
    ) => {
      if (element instanceof HTMLElement) activeMatchElement.value = element;
    };

    const getLineSegments = (line: VirtualTextLine): TextLineSegment[] => {
      if (!normalizedQuery.value) {
        return [{ text: line.text || ` `, match: false, active: false }];
      }
      const segments: TextLineSegment[] = [];
      const ranges = getTextMatchRanges(
        line.text,
        normalizedQuery.value,
        searchOptions,
      );
      let offset = 0;
      ranges.forEach((range, rangeIndex) => {
        if (range.start > offset) {
          segments.push({
            text: line.text.slice(offset, range.start),
            match: false,
            active: false,
          });
        }
        segments.push({
          text: line.text.slice(range.start, range.end),
          match: true,
          active:
            activeMatch.value?.lineKey == line.key &&
            activeMatch.value.rangeIndex == rangeIndex,
        });
        offset = range.end;
      });
      if (offset < line.text.length) {
        segments.push({
          text: line.text.slice(offset),
          match: false,
          active: false,
        });
      }
      return segments.length
        ? segments
        : [{ text: line.text || ` `, match: false, active: false }];
    };

    const copyText = async () => {
      await navigator.clipboard.writeText(options.value.value);
      message.success(`已复制当前文件内容`);
    };

    watch(options.value, () => {
      query.value = ``;
      resultIndex.value = -1;
    });

    watch([options.value, wrap], async () => {
      scrollTop.value = 0;
      await nextTick();
      scrollContainer.value?.scrollTo({ top: 0 });
      virtualList.value?.scrollTo({ index: 0 });
    });

    watch(
      [
        query,
        () => searchOptions.matchCase,
        () => searchOptions.wholeWord,
        () => searchOptions.useRegex,
        matchCount,
      ],
      (
        [actualQuery, actualMatchCase, actualWholeWord, actualUseRegex, count],
        previous,
      ) => {
        if (!actualQuery.trim() || !count) {
          resultIndex.value = -1;
          return;
        }
        const criteriaChanged =
          !previous ||
          actualQuery != previous[0] ||
          actualMatchCase != previous[1] ||
          actualWholeWord != previous[2] ||
          actualUseRegex != previous[3];
        if (
          criteriaChanged ||
          resultIndex.value < 0 ||
          resultIndex.value >= count
        ) {
          resultIndex.value = 0;
        }
      },
      { immediate: true },
    );

    watch(
      [
        normalizedQuery,
        () => searchOptions.matchCase,
        () => searchOptions.wholeWord,
        () => searchOptions.useRegex,
        resultIndex,
      ],
      async ([actualQuery, , , , actualResultIndex]) => {
        activeMatch.value = undefined;
        activeMatchElement.value = undefined;
        if (!actualQuery || actualResultIndex < 0) return;
        let remaining = actualResultIndex;
        let lineIndex = -1;
        for (let index = 0; index < lines.value.length; index++) {
          const line = lines.value[index];
          if (!line) continue;
          const ranges = getTextMatchRanges(
            line.text,
            actualQuery,
            searchOptions,
          );
          if (remaining < ranges.length) {
            lineIndex = index;
            activeMatch.value = { lineKey: line.key, rangeIndex: remaining };
            break;
          }
          remaining -= ranges.length;
        }
        if (lineIndex < 0) return;
        scrollTop.value = lineIndex * lineHeight;
        await nextTick();
        scrollContainer.value?.scrollTo({ top: scrollTop.value });
        virtualList.value?.scrollTo({ index: lineIndex });
        await nextTick();
        requestAnimationFrame(() => {
          activeMatchElement.value?.scrollIntoView({
            block: `nearest`,
            inline: `nearest`,
          });
        });
      },
      { flush: `post` },
    );

    return {
      ...options,
      query,
      resultIndex,
      searchOptions,
      wrap,
      virtualList,
      scrollContainer,
      lineHeight,
      lines,
      visibleStart,
      visibleLines,
      virtualHeight,
      normalizedQuery,
      matchCount,
      displayedResultIndex,
      invalidRegex,
      selectRelativeResult,
      handleSearchEnter,
      handleScroll,
      setActiveMatchElement,
      getLineSegments,
      copyText,
    };
  },
);

export const useProvideTextViewerState = provideTextViewerState;

export const useTextViewerState = () => {
  const state = injectTextViewerState();
  if (!state) throw new Error(`TextViewer 子组件必须在 TextViewer 内部使用`);
  return state;
};
