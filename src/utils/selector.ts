import KitSelector from '@gkd-kit/selector';
import { RawNode } from './types';
import { traverseNode } from './node';
const { CommonSelector, CommonTransform } = KitSelector.li.songe.selector;

const transform = new CommonTransform<RawNode>(
  (node, name) => {
    return Reflect.get(node.attr, name);
  },
  (node) => node.attr.name,
  (node) => node.children,
  (node) => node.parent,
);

export type Selector = {
  toString: () => string;
  match: (node: RawNode) => RawNode | undefined;
  querySelectorAll: (node: RawNode) => RawNode[];
  querySelector: (node: RawNode) => RawNode | undefined;
};

export const parseSelector = (source: string): Selector => {
  const cs = CommonSelector.Companion.parse(source);
  const selector: Selector = {
    toString: () => cs.toString(),
    match: (node: RawNode): RawNode | undefined => {
      return cs.match(node, transform) ?? void 0;
    },
    querySelectorAll: (node: RawNode): RawNode[] => {
      return transform.querySelectorAll(node, cs);
    },
    querySelector: (node: RawNode): RawNode | undefined => {
      return transform.querySelector(node, cs) as RawNode | undefined;
    },
  };
  return selector;
};
