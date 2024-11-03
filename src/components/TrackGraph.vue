<script setup lang="ts">
import '@/utils/g6';
import { getLimitLabel } from '@/utils/node';
import type { ConnectKeyType } from '@/utils/selector';
import type { RawNode, TrackValue } from '@/utils/types';
import type { TreeGraph, TreeGraphData } from '@antv/g6';
import G6 from '@antv/g6';

const props = withDefaults(
  defineProps<{
    track: TrackValue;
  }>(),
  {},
);

const visibleNodes = computed(() => {
  const nodes = Array.from(props.track.nodes).reverse();
  const trackId = props.track.nodes[props.track.selector.targetIndex]?.id;
  const topNode = (() => {
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
  subNodes.add(topNode);
  nodes.forEach((n) => {
    subNodes.add(n);
    let p: RawNode | undefined = n;
    while (p && p !== topNode) {
      subNodes.add(p);
      p = p.parent;
    }
    // if (n !== topNode && n.parent) {
    //   const selfIndex = n.parent.children.indexOf(n);
    //   if (selfIndex != 0) {
    //     n.parent.children.forEach((c, broIndex) => {
    //       if (Math.abs(broIndex - selfIndex) <= 1) {
    //         subNodes.add(c);
    //       }
    //     });
    //   }
    // }
  });
  const graphNodes = Array.from(subNodes).map<
    TreeGraphData & { _node: RawNode; children: TreeGraphData[] }
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
      t.children.push(n);
    }
  });
  graphNodes.forEach((n) => {
    if (n.children.length < n._node.children.length) {
      const rawGroup: RawNode[] = [];
      const clear = () => {
        while (rawGroup.length > 0) {
          rawGroup.pop();
        }
      };
      const insert = () => {
        if (rawGroup.length == 0) return;
        const children = rawGroup[0].parent!.children!;
        const g = rawGroup[0];
        if (
          children.length > 1 &&
          children.indexOf(g) == 1 &&
          children.indexOf(rawGroup.at(-1)!) == children.length - 1
        ) {
          clear();
          return;
        }
        n.children.push({
          _node: g,
          children: [],
          id: g.id.toString(),
          label:
            rawGroup.length == 1
              ? getLimitLabel(g)
              : `[${children.indexOf(g)} ... ${children.indexOf(
                  rawGroup.at(-1)!,
                )}]`,
          tracked: trackId === g.id,
        });
        clear();
      };
      n._node.children.forEach((c) => {
        if (!n.children.find((g) => g.id === c.id.toString())) {
          rawGroup.push(c);
        } else {
          insert();
        }
      });
      if (rawGroup.length > 0) {
        insert();
      }
      n.children.sort((a, b) => {
        return (
          n._node.children.indexOf(a._node as RawNode) -
          n._node.children.indexOf(b._node as RawNode)
        );
      });
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
      const direction =
        Number.parseInt(config.source!) > Number.parseInt(config.target!)
          ? -1
          : 1;
      const connect = String(config.connect);
      const count = Number(config.count);
      let curveOffset = 40;
      if (connect.startsWith('<<')) {
        const c = nodes.find((n) => n.id.toString() == config.source)!;
        let p = c.parent;
        let i = 1;
        while (p) {
          if (p.id.toString() == config.target) break;
          p = p.parent;
          i++;
        }
        if (i > 1) {
          curveOffset += i * 20;
        }
      }
      if (count > 1) {
        curveOffset += (count - 1) * 20;
      }
      curveOffset *= direction;
      return {
        type: 'quadratic',
        color: '#ff00ff80',
        curveOffset,
        style: {
          startArrow: true,
        },
        label: connect,
        labelCfg: {
          style: {
            fill: '#f00',
            fontSize: 12,
            background: {
              fill: '#ffffff',
              stroke: '#f0f',
              lineWidth: 1,
              padding: [2, 1, 0, 1],
              radius: 2,
            },
          },
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
  const nodes = Array.from(props.track.nodes);
  const connectKeys = props.track.selector.connectKeys;
  const edgeCountMap: Record<string, number> = {};
  nodes.forEach((n, i) => {
    const t = nodes[i + 1];
    if (t && graph) {
      const tempId = t.id > n.id ? `-${n.id}:${t.id}` : `-${t.id}:${n.id}`;
      edgeCountMap[tempId] = (edgeCountMap[tempId] || 0) + 1;
      const id = `${tempId}/${edgeCountMap[tempId]}`;
      const key = connectKeys[connectKeys.length - i - 1] as ConnectKeyType;
      const distance: number =
        {
          '+': () => {
            return t
              .parent!.children.slice(0, t.parent!.children.indexOf(t))
              .reverse()
              .indexOf(n);
          },
          '-': () => {
            return t
              .parent!.children.slice(t.parent!.children.indexOf(t) + 1)
              .indexOf(n);
          },
          '>': () => {
            let i = 0;
            let p = t.parent;
            while (p) {
              if (p === n) return i;
              p = p.parent;
              i++;
            }
            return i;
          },
          '<': () => {
            return t.children.indexOf(n);
          },
          '<<': () => {
            let i = 0;
            const stack = Array.from(t.children).reverse();
            while (stack.length > 0) {
              const c = stack.pop()!;
              if (c === n) return i;
              stack.push(...Array.from(c.children).reverse());
              i++;
            }
            return i;
          },
        }[key]() + 1;
      graph.addItem(
        'edge',
        {
          source: n.id.toString(),
          target: t.id.toString(),
          id,
          connect: distance > 1 ? key + distance : key,
          // 两个节点之间的边的数量
          count: edgeCountMap[tempId],
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
    !container.value ||
    !container.value.scrollWidth ||
    !container.value.scrollHeight
  ) {
    return;
  }
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
