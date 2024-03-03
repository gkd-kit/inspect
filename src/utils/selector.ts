import {
  MultiplatformSelector,
  MultiplatformTransform,
} from '@gkd-kit/selector';
import type { RawNode } from './types';

const transform = new MultiplatformTransform<RawNode>(
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
  tracks: boolean[];
  trackIndex: number;
  connectKeys: string[];
  canQf: boolean;
  qfIdValue: string | null | undefined;
  qfVidValue: string | null | undefined;
  qfTextValue: string | null | undefined;
  canCopy: boolean;
  toString: () => string;
  match: (node: RawNode) => RawNode | undefined;
  querySelectorAll: (node: RawNode) => RawNode[];
  querySelectorTrackAll: (node: RawNode) => RawNode[][];
};

export const parseSelector = (source: string): Selector => {
  const ms = MultiplatformSelector.Companion.parse(source);
  for (const [name, type] of ms.nameToTypeList) {
    if (!allowPropertyTypes[name]) {
      throw `未知属性: ${name}`;
    }
    if (
      type != PrimitiveValue.NullValue.type &&
      allowPropertyTypes[name] != type
    ) {
      throw `非法类型: ${name}`;
    }
  }
  const selector: Selector = {
    tracks: ms.tracks,
    trackIndex: ms.trackIndex,
    connectKeys: ms.connectKeys,
    canQf: ms.canQf,
    qfIdValue: ms.qfIdValue,
    qfVidValue: ms.qfVidValue,
    qfTextValue: ms.qfTextValue,
    canCopy: ms.propertyNames.every((name) => allowPropertyNames.has(name)),
    toString: () => ms.toString(),
    match: (node) => {
      return ms.match(node, transform) ?? void 0;
    },
    querySelectorAll: (node) => {
      return transform.querySelectorAll(node, ms);
    },
    querySelectorTrackAll: (node) => {
      return transform.querySelectorTrackAll(node, ms);
    },
  };
  return selector;
};

export const checkSelector = (source: string) => {
  return MultiplatformSelector.Companion.parseOrNull(source) != null;
};

const allowPropertyNames = new Set([
  'id',
  'vid',

  'name',
  'text',
  'text.length',
  'desc',
  'desc.length',

  'clickable',
  'focusable',
  'checkable',
  'checked',
  'editable',
  'longClickable',
  'visibleToUser',

  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',

  'index',
  'depth',
  'childCount',
]);

const PrimitiveValue = {
  StringValue: { type: 'string' },
  IntValue: { type: 'int' },
  BooleanValue: { type: 'boolean' },
  NullValue: { type: 'null' },
};

const allowPropertyTypes: Record<string, string> = {
  id: PrimitiveValue.StringValue.type,
  vid: PrimitiveValue.StringValue.type,

  name: PrimitiveValue.StringValue.type,
  text: PrimitiveValue.StringValue.type,
  'text.length': PrimitiveValue.IntValue.type,
  desc: PrimitiveValue.StringValue.type,
  'desc.length': PrimitiveValue.IntValue.type,

  clickable: PrimitiveValue.BooleanValue.type,
  focusable: PrimitiveValue.BooleanValue.type,
  checkable: PrimitiveValue.BooleanValue.type,
  checked: PrimitiveValue.BooleanValue.type,
  editable: PrimitiveValue.BooleanValue.type,
  longClickable: PrimitiveValue.BooleanValue.type,
  visibleToUser: PrimitiveValue.BooleanValue.type,

  left: PrimitiveValue.IntValue.type,
  top: PrimitiveValue.IntValue.type,
  right: PrimitiveValue.IntValue.type,
  bottom: PrimitiveValue.IntValue.type,
  width: PrimitiveValue.IntValue.type,
  height: PrimitiveValue.IntValue.type,

  index: PrimitiveValue.IntValue.type,
  depth: PrimitiveValue.IntValue.type,
  childCount: PrimitiveValue.IntValue.type,

  _id: PrimitiveValue.IntValue.type,
  _pid: PrimitiveValue.IntValue.type,
};
