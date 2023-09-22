import { CommonSelector, CommonTransform } from '@gkd-kit/selector';
import type { RawNode } from './types';

const transform = new CommonTransform<RawNode>(
  (node, name) => {
    const [key, subKey] = name.split('.');
    if (subKey) {
      // @ts-ignore
      return node.attr[key]?.[subKey];
    }
    // @ts-ignore
    return node.attr[key];
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
  if (!simpleCheck(source)) throw new Error(`invalid selector syntax`);
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

const matchEndChar = /[0-9a-zA-Z\]\*\s]+$/;
/**
 * 
 */
const simpleCheck = (source: string) => {
  source = source.trim();
  if (!source || !source.match(matchEndChar)) return false;
  return true;
};

export const checkSelector = (source: string) => {
  try {
    return !!parseSelector(source);
  } catch {
    return false;
  }
};
