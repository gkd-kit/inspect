import type Sequence from 'sequency';
import { createSequence } from 'sequency';
import type NodeExt from '../NodeExt';
import ConnectOperator from './ConnectOperator';
import PolynomialExpression from './PolynomialExpression';
import { lazyFc } from '../kotlin';
type TraversalFc = (node: NodeExt) => Sequence<NodeExt | void>;

export default class ConnectSegment {
  constructor(
    public readonly operator: ConnectOperator = ConnectOperator.Ancestor,
    public readonly polynomialExpression: PolynomialExpression = new PolynomialExpression(),
  ) {}
  toString() {
    const { operator, polynomialExpression } = this;
    if (
      operator == ConnectOperator.Ancestor &&
      polynomialExpression.a == 1 &&
      polynomialExpression.b == 0
    ) {
      return '';
    }
    return operator.toString() + polynomialExpression.toString();
  }

  traversal: TraversalFc = lazyFc(() => {
    const { polynomialExpression, operator } = this;
    if (polynomialExpression.isConstant) {
      return (node) => {
        return createSequence<NodeExt>(
          (function* () {
            const node1 = operator.traversal(node, polynomialExpression.b1);
            if (node1 != null) {
              yield node1;
            }
          })(),
        );
      };
    }
    return (node) => {
      return polynomialExpression.traversal(operator.traversal(node));
    };
  });
}
