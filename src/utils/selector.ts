import {
  MultiplatformSelector,
  MultiplatformTransform,
  updateWasmToMatches,
  getStringInvoke,
  getIntInvoke,
  getStringAttr,
  initDefaultTypeInfo,
  MismatchExpressionTypeException,
  MismatchOperatorTypeException,
  MismatchParamTypeException,
  UnknownIdentifierException,
  UnknownIdentifierMethodException,
  UnknownMemberException,
  UnknownMemberMethodException,
} from '@gkd-kit/selector';
import type { RawNode } from './types';
import matchesInstantiate from '@gkd-kit/wasm_matches';
import matchesWasmUrl from '@gkd-kit/wasm_matches/dist/mod.wasm?url';
import store from './store';
import { settingsStorage } from './storage';
import { isRawNode } from './node';

export const wasmLoadTask = matchesInstantiate(fetch(matchesWasmUrl))
  .then((mod) => {
    const toMatches = mod.exports.toMatches;
    updateWasmToMatches(toMatches as any);
    store.wasmSupported = true;
    if (import.meta.env.PROD) {
      console.log('use wasm matches');
    }
  })
  .catch((e) => {
    store.wasmSupported = false;
    console.error(e);
    if (import.meta.env.PROD) {
      console.log('use js matches');
    }
  });

const transform = new MultiplatformTransform<RawNode>(
  (target, name) => {
    if (typeof target === 'string') {
      return getStringAttr(target, name);
    }
    if (isRawNode(target)) {
      if (name == '_id') return target.id;
      if (name == '_pid') return target.pid;
      if (name == 'parent') return target.parent ?? null;
      return Reflect.get(target.attr, name) ?? null;
    }
    return null;
  },
  (target, name, args) => {
    if (typeof target === 'string') {
      return getStringInvoke(target, name, args);
    }
    if (typeof target === 'number') {
      return getIntInvoke(target, name, args);
    }
    if (isRawNode(target)) {
      if (name === 'getChild') {
        const i = args.asJsReadonlyArrayView()[0];
        return target.children[i] ?? null;
      }
    }
    return null;
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

export type ConnectKeyType = '+' | '-' | '>' | '<' | '<<';

const typeInfo = initDefaultTypeInfo();

export const parseSelector = (source: string): Selector => {
  const ms = MultiplatformSelector.Companion.parse(source);
  for (const exp of ms.binaryExpressions) {
    if (exp.operator.value.key == '~=' && !store.wasmSupported) {
      if (!settingsStorage.ignoreWasmWarn) {
        store.wasmErrorDlgVisible = true;
        break;
      }
    }
  }
  const error = ms.checkType(typeInfo.contextType);
  if (error != null) {
    if (error instanceof MismatchExpressionTypeException) {
      throw new Error('不匹配表达式类型:' + error.exception.stringify(), {
        cause: error,
      });
    }
    if (error instanceof MismatchOperatorTypeException) {
      throw new Error('不匹配操作符类型:' + error.exception.stringify(), {
        cause: error,
      });
    }
    if (error instanceof MismatchParamTypeException) {
      throw new Error('不匹配参数类型:' + error.call.stringify(), {
        cause: error,
      });
    }
    if (error instanceof UnknownIdentifierException) {
      throw new Error('未知属性:' + error.value.value, {
        cause: error,
      });
    }
    if (error instanceof UnknownIdentifierMethodException) {
      throw new Error('未知方法:' + error.value.value, {
        cause: error,
      });
    }
    if (error instanceof UnknownMemberException) {
      throw new Error('未知属性:' + error.value.property, {
        cause: error,
      });
    }
    if (error instanceof UnknownMemberMethodException) {
      throw new Error('未知方法:' + error.value.property, {
        cause: error,
      });
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
    canCopy: true, // TODO check copy
    toString: () => ms.toString(),
    match: (node) => {
      return ms.match(node, transform) ?? undefined;
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
