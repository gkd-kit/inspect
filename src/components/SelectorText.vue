<script setup lang="ts">
import { AstNode, Selector } from '@gkd-kit/selector';
import SelectorText from './SelectorText.vue';
import { getAstNodeClassName } from '@/utils/selector';
import type { StyleValue } from 'vue';

const props = defineProps<{
  source: string;
  node: AstNode<any>;
  getNodeStyle?: (node: AstNode<any>) => StyleValue;
}>();

const isRoot = computed(() => {
  return props.node.value instanceof Selector;
});

const subText = computed(() => {
  return props.source.substring(props.node.start, props.node.end);
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
  const firstChild = props.node.outChildren[0];
  if (firstChild.start !== props.node.start) {
    list.push({
      start: props.node.start,
      end: firstChild.start,
    });
  }
  props.node.outChildren.forEach((child, i) => {
    list.push(child);
    const nextChild = props.node.outChildren[i + 1];
    if (nextChild && child.end !== nextChild.start) {
      list.push({
        start: child.end,
        end: nextChild.start,
      });
    }
  });
  const lastChild = props.node.outChildren[props.node.outChildren.length - 1];
  if (lastChild.end !== props.node.end) {
    list.push({
      start: lastChild.end,
      end: props.node.end,
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
    class="SelectorText"
    :whitespace-pre-wrap="isRoot ? `` : undefined"
    :data-name="getAstNodeClassName(node)"
    :data-range="getRange(node)"
    :data-value="getDataValue(subText)"
    :style="getNodeStyle?.(node)"
  >
    <template v-if="node.outChildren.length">
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
