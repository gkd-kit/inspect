import type Sequence from 'sequency';
import type NodeExt from '../NodeExt';

type TraversalFc = {
  (node: NodeExt): Sequence<NodeExt | void>;
  (node: NodeExt, offset: number): NodeExt | void;
};

export default class ConnectOperator {
  constructor(
    public readonly key: string,
    public readonly traversal: TraversalFc,
  ) {}
  static allSubClasses: ConnectOperator[] = [];
  static Ancestor: ConnectOperator;
  toString() {
    return this.key;
  }
}

const BeforeBrother = new ConnectOperator(`+`, ((node, offset) => {
  if (offset !== undefined) {
    return node.getBeforeBrother(offset);
  }
  return node.beforeBrothers;
}) as TraversalFc);

const AfterBrother = new ConnectOperator(`-`, ((node, offset) => {
  if (offset !== undefined) {
    return node.getAfterBrother(offset);
  }
  return node.afterBrothers;
}) as TraversalFc);

const Ancestor = new ConnectOperator(`>`, ((node, offset) => {
  if (offset !== undefined) {
    return node.getAncestor(offset);
  }
  return node.ancestors;
}) as TraversalFc);

const Child = new ConnectOperator(`<`, ((node, offset) => {
  if (offset !== undefined) {
    return node.getChild(offset);
  }
  return node.children;
}) as TraversalFc);

ConnectOperator.allSubClasses = [
  BeforeBrother,
  AfterBrother,
  Ancestor,
  Child,
].sort((a, b) => {
  return b.key.length - a.key.length;
});
ConnectOperator.Ancestor = Ancestor;
