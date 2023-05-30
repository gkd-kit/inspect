import NodeExt from '../NodeExt';
import ConnectSegment from './ConnectSegment';
import PropertyWrapper from './PropertyWrapper';

export default class ConnectWrapper {
  constructor(
    public readonly connectSegment: ConnectSegment,
    public readonly to: PropertyWrapper,
  ) {}

  toString(): string {
    const { connectSegment, to } = this;
    return (to.toString() + '\u0020' + connectSegment.toString()).trim();
  }
  match(
    node: NodeExt,
    trackNodes: Array<NodeExt> = [],
  ): Array<NodeExt> | null | void {
    const { connectSegment, to } = this;
    for (const it of connectSegment.traversal(node).asIterable()) {
      if (it == null) continue;
      const r = to.match(it, trackNodes);
      if (r) return r;
    }
    return null;
  }
}
