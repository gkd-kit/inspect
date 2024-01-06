import G6 from '@antv/g6';

G6.registerNode('file-node', {
  draw(cfg, group) {
    const keyShape = group.addShape('rect', {
      name: 'rect-shape',
      attrs: {
        x: 0,
        y: 0,
        fill: '#fff',
        stroke: null,
      },
    });
    let isLeaf = (cfg.children as []).length == 0;
    if (!isLeaf) {
      group.addShape('marker', {
        name: 'marker-shape',
        attrs: {
          symbol: 'triangle-down',
          x: 0,
          y: 0,
          r: 4,
          fill: '#767c82',
        },
      });
    }
    const shape = group.addShape('text', {
      name: 'text-shape',
      attrs: {
        x: 6,
        y: 8,
        fontSize: 16,
        text: cfg.label,
        fill: '#333639',
        textAlign: 'left',
        fontFamily: window
          .getComputedStyle(document.body, null)
          .getPropertyValue('font-family'),
      },
    });
    return keyShape;
  },
});
G6.registerEdge(
  'step-line',
  {
    getControlPoints(cfg) {
      const startPoint = cfg.startPoint!;
      const endPoint = cfg.endPoint!;
      return [
        startPoint,
        {
          x: startPoint?.x,
          y: endPoint?.y,
        },
        endPoint,
      ];
    },
  },
  'polyline',
);
