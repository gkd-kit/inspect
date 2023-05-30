import type Sequence from 'sequency';
import type NodeExt from '../NodeExt';
import { emptySequence } from 'sequency';
import { lazyFc } from '../kotlin';

type TraversalFc = (_: Sequence<NodeExt | void>) => Sequence<NodeExt | void>;

export default class PolynomialExpression {
  constructor(public readonly a = 0, public readonly b = 1) {}
  toString() {
    const { a, b } = this;
    if (a == 0 && b == 0) return '0';
    if (a == 1 && b == 1) return '(n+1)';
    if (b == 0) {
      if (a == 1) return 'n';
      return a > 0 ? `${a}n` : `(${a}n)`;
    }
    if (a == 0) {
      if (b == 1) return '';
      return b > 0 ? b.toString() : `(${b})`;
    }
    const bOp = b >= 0 ? '+' : '';
    return `(${a}n${bOp}${b})`;
  }
  get b1() {
    return this.b - 1;
  }
  get isConstant() {
    return this.a == 0;
  }

  traversal: TraversalFc = lazyFc(() => {
    const { a, b, b1 } = this;
    if (a <= 0 && b <= 0) {
      return () => emptySequence();
    }
    return (sequence) => {
      return sequence.filterIndexed(
        (x) => (x - b1) % a == 0 && (x - b1) / a > 0,
      );
    };
  });
}
