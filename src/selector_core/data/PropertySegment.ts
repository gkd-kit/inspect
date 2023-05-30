import type NodeExt from '../NodeExt';
import { lazyFc } from '../kotlin';
import BinaryExpression from './BinaryExpression';

export default class PropertySegment {
  constructor(
    public readonly tracked: boolean,
    public readonly name: string,
    public readonly expressions: BinaryExpression[],
  ) {}
  toString() {
    const { tracked, name, expressions } = this;
    const matchTag = tracked ? '@' : '';
    return matchTag + name + expressions.join('');
  }
  matchName: (node: NodeExt) => boolean = lazyFc(() => {
    const { name } = this;
    if (name.trim().length == 0 || name == `*`) {
      return () => true;
    }
    return (node) => {
      const str = node.name;
      return (
        str === name ||
        (str.endsWith(name) && str[str.length - name.length - 1] == '.')
      );
    };
  });

  matchExpressions(node: NodeExt) {
    return this.expressions.every((ex) => ex.match(node));
  }

  match(node: NodeExt) {
    return this.matchName(node) && this.matchExpressions(node);
  }
}
