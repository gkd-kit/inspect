<script setup lang="ts">
import { AstNode, Selector } from '@gkd-kit/selector';
import SelectorText from './SelectorText.vue';
import { getAstNodeClassName } from '@/entities/selector/parser';
import { inspectSelectorSyntax } from '@/entities/selector/diagnostics';
import type { StyleValue } from 'vue';

const props = defineProps<{
  source: string;
  node?: AstNode<any>;
  getNodeStyle?: (node: AstNode<any>) => StyleValue;
}>();

const renderNode = computed(() => {
  if (props.node) return props.node;
  const diagnostic = inspectSelectorSyntax(props.source);
  return diagnostic.status == 'valid' ? diagnostic.selector.ast : undefined;
});

const isRoot = computed(() => {
  return renderNode.value?.value instanceof Selector;
});

const subText = computed(() => {
  const node = renderNode.value;
  return node ? props.source.substring(node.start, node.end) : props.source;
});

interface ExtraNode {
  start: number;
  end: number;
}

const getExtraText = (child: ExtraNode) => {
  return props.source.substring(child.start, child.end);
};

const getExtraName = (child: ExtraNode) => {
  const t = props.source.substring(child.start, child.end).trim();
  if (!t) {
    return 'Whitespace';
  }
  if (t === '+') {
    return '';
  }
  if (t === '-') {
    return '';
  }
  if (t === 'n') {
    return '';
  }
  return 'Unknown';
};

const isAstNode = (node: unknown): node is AstNode<any> => {
  return node instanceof AstNode;
};

const getRange = (child: AstNode<any> | ExtraNode) => {
  return `${child.start}-${child.end}`;
};

const children = computed(() => {
  const list: (AstNode<any> | ExtraNode)[] = [];
  const node = renderNode.value;
  if (!node?.outChildren.length) return list;
  const firstChild = node.outChildren[0];
  if (firstChild.start !== node.start) {
    list.push({
      start: node.start,
      end: firstChild.start,
    });
  }
  node.outChildren.forEach((child, i) => {
    list.push(child);
    const nextChild = node.outChildren[i + 1];
    if (nextChild && child.end !== nextChild.start) {
      list.push({
        start: child.end,
        end: nextChild.start,
      });
    }
  });
  const lastChild = node.outChildren[node.outChildren.length - 1];
  if (lastChild.end !== node.end) {
    list.push({
      start: lastChild.end,
      end: node.end,
    });
  }
  return list;
});

const getDataValue = (str: string) => {
  return str.length === 1 ? str : undefined;
};
</script>
<template>
  <span
    v-if="renderNode"
    class="SelectorText"
    :whitespace-pre-wrap="isRoot ? `` : undefined"
    :data-name="getAstNodeClassName(renderNode)"
    :data-range="getRange(renderNode)"
    :data-value="getDataValue(subText)"
    :style="getNodeStyle?.(renderNode)"
  >
    <template v-if="renderNode.outChildren.length">
      <template v-for="child in children" :key="child.start">
        <SelectorText
          v-if="isAstNode(child)"
          :source="source"
          :node="child"
          :getNodeStyle="getNodeStyle"
        />
        <span
          v-else
          :data-name="getExtraName(child)"
          :data-range="getRange(child)"
          :data-value="getDataValue(getExtraText(child))"
        >
          {{ getExtraText(child) }}
        </span>
      </template>
    </template>
    <template v-else>
      {{ subText }}
    </template>
  </span>
  <span v-else class="SelectorText" whitespace-pre-wrap>{{ source }}</span>
</template>
<style>
[data-name~='Unknown'] {
  background-color: red;
}
[data-name~='PropertySegment'] {
  color: blueviolet;
}
[data-name~='PropertySegment'] [data-name='String'][data-value='@'] {
  color: rgb(98, 55, 138);
}
[data-name~='ConnectOperator'] {
  color: green;
}
[data-name~='ConnectExpression'] {
  color: cadetblue;
}
[data-name~='ValueExpression'] {
  color: green;
}
[data-name~='ValueExpression'][data-name~='LiteralExpression'] {
  color: steelblue;
}
[data-name~='CompareOperator'] {
  color: mediumblue;
}
[data-name~='LogicalOperator'] {
  color: darkgreen;
}
[data-name~='SelectorLogicalOperator'] {
  color: darkgreen;
}
[data-name='String'][data-value=')'],
[data-name='String'][data-value='('] {
  color: #b392f0;
}
[data-name='String'][data-value=']'],
[data-name='String'][data-value='['] {
  color: #b392f0;
}
[data-name='String'][data-value=','] {
  color: #5e418c;
}
[data-name='String'][data-value='.'] {
  color: #b392f0;
}
</style>
