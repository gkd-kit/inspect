<script setup lang="ts">
import {
  Selector,
  type SelectorToken,
  type SelectorPosition,
} from '@gkd-kit/selector';
import {
  getSelectorTextSegments,
  type SelectorTextRange,
} from '../highlighting';

const props = defineProps<{
  source: string;
  tokens?: SelectorToken[];
  positions?: SelectorPosition[];
  range?: SelectorTextRange | null;
  highlightedRanges?: SelectorTextRange[];
}>();

const parsed = computed(() =>
  props.tokens ? undefined : Selector.parse(props.source),
);
const segments = computed(() =>
  getSelectorTextSegments(
    props.source,
    props.tokens ?? parsed.value!.tokens,
    props.positions ?? parsed.value?.positions,
    props.range ?? undefined,
    props.highlightedRanges,
  ),
);
</script>
<template>
  <span class="SelectorText" whitespace-pre-wrap
    ><span
      v-for="segment in segments"
      :key="segment.start"
      :class="{ 'selector-text-highlighted': segment.highlighted }"
      ><span
        v-for="token in segment.tokens"
        :key="token.start"
        :data-kind="token.kind"
        :data-scope="token.scope"
        :data-positions="token.positions"
        :data-range="`${token.start}-${token.end}`"
        >{{ token.text }}</span
      ></span
    ></span
  >
</template>
<style scoped>
.selector-text-highlighted {
  outline: 1px solid #00f;
}
[data-kind='Invalid'] {
  background-color: rgba(208, 48, 80, 0.24);
}
[data-kind='Selector'],
[data-kind='Target'],
[data-kind='Wildcard'] {
  color: blueviolet;
}
[data-kind='Identifier'] {
  color: green;
}
[data-kind='String'],
[data-kind='Integer'],
[data-kind='Keyword'] {
  color: steelblue;
}
[data-scope='Relation'] {
  color: cadetblue;
}
[data-kind='RelationOperator'] {
  color: green;
}
[data-kind='CompareOperator'] {
  color: mediumblue;
}
[data-kind='LogicalOperator'] {
  color: darkgreen;
}
[data-kind='Punctuation'] {
  color: #b392f0;
}
</style>
