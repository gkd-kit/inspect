<script setup lang="ts">
import '@/utils/g6';
import { getLimitLabel } from '@/utils/node';
import type { Selector } from '@/utils/selector';
import type { RawNode } from '@/utils/types';
import type { TreeGraph, TreeGraphData } from '@antv/g6';
import G6 from '@antv/g6';
import { computed, onUnmounted, shallowRef, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{
    track: {
      selector: Selector;
      nodes: RawNode[];
    };
  }>(),
  {},
);

const visibleNodes = computed(() => {
  const nodes = props.track.nodes;
  const trackId = props.track.nodes[props.track.selector.trackIndex]?.id;
  const minNode = (() => {
    const tempNode = nodes.reduce((p, c) => {
      return c.id < p.id ? c : p;
    }, nodes[0]);
    if (
      tempNode.parent &&
      nodes.some((n) => n !== tempNode && n.pid == tempNode.pid)
    ) {
      return tempNode.parent;
    } else {
      return tempNode;
    }
  })();
  const subNodes = new Set<RawNode>();
  subNodes.add(minNode);
  nodes.forEach((n) => {
    subNodes.add(n);
    let p: RawNode | undefined = n;
    while (p && p !== minNode) {
      subNodes.add(p);
      p = p.parent;
    }
    if (n !== minNode && n.parent) {
      n.parent.children.forEach((c) => {
        subNodes.add(c);
      });
    }
  });
  const graphNodes = Array.from(subNodes).map<
    TreeGraphData & { _node: RawNode }
  >((n) => {
    return {
      _node: n,
      children: [],
      id: n.id.toString(),
      label: getLimitLabel(n),
      tracked: trackId === n.id,
    };
  });
  graphNodes.sort((a, b) => {
    return a._node.id - b._node.id;
  });
  graphNodes.forEach((n) => {
    const t = graphNodes.find((g) => g.id === n._node.pid.toString());
    if (t) {
      t.children!.push(n);
    }
  });
  return graphNodes;
});

const container = shallowRef<HTMLElement>();
let graph: TreeGraph | undefined = undefined;
watchEffect(() => {
  if (!container.value) return;
  graph?.destroy();
  const width = container.value.scrollWidth;
  const height = container.value.scrollHeight || width;
  graph = new G6.TreeGraph({
    container: container.value,
    width,
    height,
    modes: {
      default: ['drag-canvas', 'zoom-canvas'],
    },
    layout: {
      type: 'indented',
      indent: 25,
      getHeight() {
        return 10;
      },
    },
  });
  graph.node((config) => {
    return {
      type: 'file-node',
    };
  });
  graph.edge((config) => {
    if (config.id && config.id.startsWith('-')) {
      const curveOffset =
        Number.parseInt(config.source!) > Number.parseInt(config.target!)
          ? 20
          : -20;
      return {
        type: 'arc',
        color: '#f0f',
        curveOffset,
        style: {
          startArrow: true,
        },
      };
    }
    return {
      type: 'step-line',
    };
  });
  graph.data({
    ...visibleNodes.value[0],
  });
  graph.render();
  const nodes = Array.from(props.track.nodes).reverse();
  nodes.forEach((n, i) => {
    if (nodes[i + 1] && graph) {
      const id = `-${n.id}:${nodes[i + 1].id}`;
      graph.addItem(
        'edge',
        {
          source: n.id.toString(),
          target: nodes[i + 1].id.toString(),
          id,
        },
        false,
      );
    }
  });
  graph.fitView(30);
});
onUnmounted(() => {
  graph?.destroy();
});
const resize = () => {
  if (!graph || graph.get('destroyed') || !container.value) return;
  if (
    !container ||
    !container.value.scrollWidth ||
    !container.value.scrollHeight
  )
    return;
  graph.changeSize(container.value.scrollWidth, container.value.scrollHeight);
};
window.addEventListener('resize', resize);
onUnmounted(() => {
  window.removeEventListener('resize', resize);
});
</script>
<template>
  <div ref="container"></div>
</template>
