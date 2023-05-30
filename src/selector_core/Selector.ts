import type NodeExt from './NodeExt';
import PropertyWrapper from './data/PropertyWrapper';
import { selectorParser } from './parser/ParserSet';

export default class Selector {
  constructor(public readonly propertyWrapper: PropertyWrapper) {
    this._toString = propertyWrapper.toString();
  }
  private _toString: string;
  toString() {
    return this._toString;
  }
  match(node: NodeExt): NodeExt | void {
    const trackNodes = this.propertyWrapper.match(node);
    if (!trackNodes) return;
    return trackNodes.at(-1) ?? node;
  }
  static parse(source: string) {
    return selectorParser(source);
  }
}
