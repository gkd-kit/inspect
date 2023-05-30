import NodeExt from '../NodeExt';
import ConnectWrapper from './ConnectWrapper';
import PropertySegment from './PropertySegment';

export default class PropertyWrapper {
  constructor(
    public readonly propertySegment: PropertySegment,
    public readonly to?: ConnectWrapper,
  ) {}
  toString(): string {
    const { propertySegment, to } = this;
    return (
      (to != null ? to.toString() + '\u0020' : '') + propertySegment.toString()
    );
  }
  match(
    node: NodeExt,
    trackNodes: Array<NodeExt> = [],
  ): Array<NodeExt> | null | void {
    const { propertySegment, to } = this;
    if (!propertySegment.match(node)) {
      return null;
    }
    if (propertySegment.tracked || trackNodes.length == 0) {
      trackNodes.push(node);
    }
    if (to == null) {
      return trackNodes;
    }
    return to.match(node, trackNodes);
  }
}
