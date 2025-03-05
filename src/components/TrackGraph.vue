<script setup lang="ts">
import { getNodeQf, getTrackTreeContext } from '@/utils/node';
import { colorList } from '@/utils/others';
import { transform } from '@/utils/selector';
import type { RawNode } from '@/utils/types';
import type { EdgeData, TreeData } from '@antv/g6';
import { Graph, treeToGraphData } from '@antv/g6';
import { QueryPath, QueryResult } from '@gkd-kit/selector';
import { uniqBy } from 'lodash-es';
import { AntQuadratic } from '@/utils/g6';

const props = withDefaults(
  defineProps<{
    nodes: RawNode[];
    queryResult: QueryResult<RawNode>;
    showUnitResults: QueryResult.UnitResult<RawNode>[];
    filterUnitResults?: QueryResult.UnitResult<RawNode>[];
  }>(),
  {},
);

const el = ref<HTMLElement>();

const getNode = (id: string | number): RawNode => {
  return props.nodes[id as number];
};

const subNodes = computed(() => {
  return uniqBy(
    props.queryResult.unitResults
      .asJsReadonlyArrayView()
      .flatMap((v) => v.context.toArray()),
    (n) => n.id,
  );
});

const treeCtx = computed(() => {
  return getTrackTreeContext(props.nodes, subNodes.value);
});

const toTreeData = (node: RawNode): TreeData => {
  const data: TreeData = {
    id: node.id.toString(),
    children: treeCtx.value.getChildren(node).map(toTreeData),
  };
  return data;
};

const treeGraphData = computed(() => {
  return treeToGraphData(toTreeData(treeCtx.value.topNode));
});

const hasChildren = (node: RawNode): boolean => {
  return treeCtx.value.getChildren(node).length > 0;
};

interface EdgeContext {
  groupList: {
    result: QueryResult.UnitResult<RawNode>;
    edgeGroup: EdgeData[];
  }[];
  edgeList: EdgeData[];
  getLabel: (edge: EdgeData) => string;
  getColor: (edge: EdgeData) => string;
  getGroupIndex: (edge: EdgeData) => number;
}

const edgeCtx = computed<EdgeContext>(() => {
  const countMap: Record<string, number> = {};
  const edgePathMap: Record<string, QueryPath<RawNode>> = {};
  const getNodeEdge = (path: QueryPath<RawNode>): EdgeData => {
    const key = `#${path.source.id}-${path.target.id}`;
    const count = countMap[key] || 0;
    countMap[key] = count + 1;
    const id = key + (count > 0 ? `-${count}` : '');
    edgePathMap[id] = path;
    return {
      id,
      source: String(path.source.id),
      target: String(path.target.id),
    };
  };
  const resultAndPathList = props.showUnitResults.map((result) => {
    return {
      result,
      pathList: result
        .getNodeConnectPath(transform)
        .asJsReadonlyArrayView()
        .concat(),
    };
  });
  const groupList = resultAndPathList.map(({ result, pathList }) => {
    const edgeGroup = pathList.map((v) => getNodeEdge(v));
    return {
      result,
      edgeGroup,
    };
  });
  const edgeList = groupList.flatMap((v) => v.edgeGroup);
  const getLabel = (edge: EdgeData): string => {
    return edgePathMap[edge.id!].formatConnectOffset;
  };
  const getGroupIndex = (edge: EdgeData): number => {
    return groupList.findIndex((v) =>
      v.edgeGroup.some((e) => e.id === edge.id),
    );
  };
  const getColor = (edge: EdgeData): string => {
    const i = props.showUnitResults.indexOf(
      groupList[getGroupIndex(edge)].result,
    );
    return colorList[i % colorList.length];
  };
  return {
    groupList,
    edgeList,
    getLabel,
    getColor,
    getGroupIndex,
  };
});

const isCurveEdge = (edge: EdgeData): boolean => {
  return edge.id?.[0] === '#';
};

const getDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  return Math.sqrt(
    Math.pow(Math.abs(x1 - x2), 2) + Math.pow(Math.abs(y1 - y2), 2),
  );
};

const getEdgeDistance = (g: Graph, d: EdgeData): number => {
  const n1 = g.getNodeData(d.source);
  const n2 = g.getNodeData(d.target);
  return getDistance(
    n1.style?.x || 0,
    n1.style?.y || 0,
    n2.style?.x || 0,
    n2.style?.y || 0,
  );
};

const numReg = /\d+/;

const graphRef = shallowRef<Graph>();
onUnmounted(() => {
  if (graphRef.value) {
    graphRef.value.destroy();
  }
});
watch(el, async () => {
  if (!el.value) {
    return;
  }
  const graph = new Graph({
    container: el.value,
    data: treeGraphData.value,
    autoFit: 'view',
    padding: [24, 48],
    animation: false,
    node: {
      type(d) {
        const node = getNode(d.id);
        return hasChildren(node) ? 'triangle' : 'rect';
      },
      style(d) {
        const node = getNode(d.id);
        const isTarget = props.queryResult.target.id === node.id;
        const placeholdered = treeCtx.value.isPlaceholder(node);
        const qf = getNodeQf(node);
        return {
          size: hasChildren(node) ? 4 : 1,
          direction: hasChildren(node) ? 'down' : undefined,
          fill: hasChildren(node) ? '#767C82' : '#E3E3E3',
          pointerEvents: 'none',
          labelPlacement: 'right',
          labelText: treeCtx.value.getLabel(node),
          labelOffsetX: 2,
          labelFontWeight: qf && !placeholdered ? 'bold' : undefined,
          labelOpacity: placeholdered ? 0.5 : undefined,
          labelPointerEvents: 'none',
          labelStroke: isTarget ? '#0FF' : undefined,
        };
      },
    },
    edge: {
      type(d) {
        return isCurveEdge(d) ? AntQuadratic.tyoe : 'polyline';
      },
      style(d) {
        if (isCurveEdge(d)) {
          const distance = getEdgeDistance(graph, d);
          const labelText = edgeCtx.value.getLabel(d);
          const hasNum = labelText.match(numReg);
          return {
            curveOffset: 30 * (Number(d.source) > Number(d.target) ? 1 : -1),
            stroke: edgeCtx.value.getColor(d) || '#FF7FFF',
            zIndex: 1 + edgeCtx.value.getGroupIndex(d),
            pointerEvents: 'none',
            endArrow: true,
            endArrowOpacity: 0.5,
            endArrowPointerEvents: 'none',
            labelText,
            labelFill: '#F00',
            labelFontSize: hasNum ? (distance < 50 ? 8 : 12) : 12,
            labelBackground: true,
            labelBackgroundStroke: '#FF00FF',
            labelPadding: hasNum ? [0, 1, -2, 0] : [0, 0, -1, 0],
            labelBackgroundLineWidth: 1,
            labelBackgroundRadius: 2,
            labelBackgroundPointerEvents: 'none',
            labelOffsetX: distance < 50 ? -5 : 0,
            labelPointerEvents: 'none',
            lineDash: [AntQuadratic.lineDashGap, AntQuadratic.lineDashGap],
          };
        }
        return {
          router: {
            type: 'orth',
          },
          stroke: '#E3E3E3',
          pointerEvents: 'none',
        };
      },
    },
    layout: {
      type: 'indented',
      direction: 'LR',
      indent: 20,
      getHeight: () => 0,
    },
    behaviors: ['drag-canvas', 'zoom-canvas'],
  });
  await graph.render();
  graphRef.value = graph;
});

const showEdgeList = computed(() => {
  const list = props.filterUnitResults;
  if (!list?.length) {
    return [];
  }
  return edgeCtx.value.groupList
    .filter((g) => list.includes(g.result))
    .flatMap((v) => v.edgeGroup);
});

watch(
  [graphRef, showEdgeList],
  async ([graph, newEdgeList], [_, oldEdgeList]) => {
    if (!graph) return;
    if (newEdgeList !== oldEdgeList) {
      const removeEdgeList = oldEdgeList.filter(
        (v) => !newEdgeList.some((e) => e.id === v.id),
      );
      const addEdgeList = newEdgeList.filter(
        (v) => !oldEdgeList.some((e) => e.id === v.id),
      );
      if (!removeEdgeList.length && !addEdgeList.length) {
        return;
      }
      graph.removeEdgeData(removeEdgeList.map((v) => v.id!));
      await graph.draw();
      graph.addEdgeData(addEdgeList);
    } else {
      graph.addEdgeData(newEdgeList);
    }
    await graph.draw();
  },
);
</script>
<template>
  <div class="TrackGraph" ref="el"></div>
</template>
