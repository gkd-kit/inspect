import { ExtensionCategory, Quadratic, register } from '@antv/g6';

export class AntQuadratic extends Quadratic {
  static tyoe = 'ant-quadratic';
  static lineDashGap = 5;
  onCreate() {
    this.shapeMap.key.animate(
      [{ lineDashOffset: AntQuadratic.lineDashGap * 2 }, { lineDashOffset: 0 }],
      {
        duration: 500,
        iterations: Infinity,
        delay: 0,
      },
    );
  }
}

register(ExtensionCategory.EDGE, AntQuadratic.tyoe, AntQuadratic, true);
