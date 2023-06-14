import type NodeExt from '../NodeExt';
import type CompareOperator from './CompareOperator';

export default class BinaryExpression {
  constructor(
    public readonly name: string,
    public readonly operator: CompareOperator,
    public readonly value: unknown,
  ) {}
  match(node: NodeExt) {
    return this.operator.compare(node.attr(this.name), this.value);
  }
  toString() {
    const literalValue =
      typeof this.value == 'string'
        ? `'${this.value.replaceAll(`'`, `\\'`)}'`
        : this.value;
    return `[${this.name}${this.operator.toString()}${literalValue}]`;
  }
}
