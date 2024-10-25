import {
  Context,
  FastQuery,
  getBooleanInvoke,
  getIntInvoke,
  getStringAttr,
  getStringInvoke,
  initDefaultTypeInfo,
  MatchOption,
  MismatchExpressionTypeException,
  MismatchOperatorTypeException,
  MismatchParamTypeException,
  Selector,
  Transform,
  UnknownIdentifierException,
  UnknownIdentifierMethodException,
  UnknownIdentifierMethodParamsException,
  UnknownMemberException,
  UnknownMemberMethodException,
  UnknownMemberMethodParamsException,
  updateWasmToMatches,
} from '@gkd-kit/selector';
import matchesInstantiate from '@gkd-kit/wasm_matches';
import matchesWasmUrl from '@gkd-kit/wasm_matches/dist/mod.wasm?url';
import { isRawNode } from './node';
import type { RawNode } from './types';

export const wasmLoadTask = matchesInstantiate(fetch(matchesWasmUrl))
  .then((mod) => {
    const toMatches = mod.exports.toMatches;
    updateWasmToMatches(toMatches as any);
    useGlobalStore().wasmSupported = true;
    if (import.meta.env.PROD) {
      console.log('use wasm matches');
    }
  })
  .catch((e) => {
    useGlobalStore().wasmSupported = false;
    console.error(e);
    if (import.meta.env.PROD) {
      console.log('use js matches');
    }
  });

const getNodeAttr = (target: RawNode, name: string) => {
  if (name == '_id') return target.id;
  if (name == '_pid') return target.pid;
  if (name == 'parent') return target.parent ?? null;
  return Reflect.get(target.attr, name) ?? null;
};

const getNodeInvoke = (target: RawNode, name: string, args: any) => {
  if (name === 'getChild') {
    const i = args.asJsReadonlyArrayView()[0];
    return target.children[i] ?? null;
  }
  return null;
};

const transform = Transform.Companion.multiplatformBuild<RawNode>(
  (target, name) => {
    if (typeof target === 'string') {
      return getStringAttr(target, name);
    }
    if (target instanceof Context) {
      if (name === 'prev') {
        return target.prev;
      }
      if (name === 'current') {
        return target.current;
      }
      return getNodeAttr(target.current, name);
    }
    if (isRawNode(target)) {
      return getNodeAttr(target, name);
    }
    return null;
  },
  (target, name, args) => {
    if (typeof target === 'number') {
      return getIntInvoke(target, name, args);
    }
    if (typeof target === 'boolean') {
      return getBooleanInvoke(target, name, args);
    }
    if (typeof target === 'string') {
      return getStringInvoke(target, name, args);
    }
    if (target instanceof Context) {
      if (name === 'getPrev') {
        const i = args.asJsReadonlyArrayView()[0];
        if (Number.isSafeInteger(i)) {
          return target.getPrev(i);
        }
        return null;
      }
      return getNodeInvoke(target.current, name, args);
    }
    if (isRawNode(target)) {
      return getNodeInvoke(target, name, args);
    }
    return null;
  },
  (node) => node.attr.name,
  (node) => node.children,
  (node) => node.parent,
);

export type GkdSelector = {
  s: Selector;
  targetIndex: number;
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

const typeInfo = initDefaultTypeInfo(true).globalType;
const matchOption = new MatchOption(false, false);

export const parseSelector = (source: string): GkdSelector => {
  const s = Selector.Companion.parse(source);
  for (const exp of s.binaryExpressions) {
    if (exp.operator.value.key == '~=' && !useGlobalStore().wasmSupported) {
      if (!useSettingsStore().ignoreWasmWarn) {
        useGlobalStore().wasmErrorDlgVisible = true;
        break;
      }
    }
  }
  checkError(s);
  const selector: GkdSelector = {
    s,
    targetIndex: s.targetIndex,
    connectKeys: s.connectWrappers.map((c) => c.segment.operator.key),
    canQf: !!s.quickFindValue?.value,
    qfIdValue:
      s.quickFindValue instanceof FastQuery.Id ? s.quickFindValue.value : null,
    qfVidValue:
      s.quickFindValue instanceof FastQuery.Vid ? s.quickFindValue.value : null,
    qfTextValue:
      s.quickFindValue instanceof FastQuery.Text
        ? s.quickFindValue.value
        : null,
    canCopy: !s.binaryExpressions.some((b) =>
      b.properties.some((p) => p.startsWith('_')),
    ),
    toString: () => s.stringify(),
    match: (node) => {
      return s.match(node, transform, matchOption) ?? undefined;
    },
    querySelectorAll: (node) => {
      return transform.querySelectorAllArray(node, s);
    },
    querySelectorTrackAll: (node) => {
      return transform
        .querySelectorAllContextArray(node, s)
        .map((v) => v.toArray());
    },
  };
  return selector;
};

export const checkSelector = (source: string) => {
  return Selector.Companion.parseOrNull(source) != null;
};

const checkError = (s: Selector) => {
  const error = s.checkType(typeInfo);
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
      throw new Error('未知属性:' + error.value.stringify(), {
        cause: error,
      });
    }
    if (error instanceof UnknownIdentifierMethodException) {
      throw new Error('未知方法:' + error.value.stringify(), {
        cause: error,
      });
    }
    if (error instanceof UnknownMemberException) {
      throw new Error('未知属性:' + error.value.stringify(), {
        cause: error,
      });
    }
    if (error instanceof UnknownMemberMethodException) {
      throw new Error('未知方法:' + error.value.property, {
        cause: error,
      });
    }
    if (error instanceof UnknownIdentifierMethodParamsException) {
      throw new Error('未知方法参数:' + error.value.stringify(), {
        cause: error,
      });
    }
    if (error instanceof UnknownMemberMethodParamsException) {
      throw new Error('未知方法参数:' + error.value.stringify(), {
        cause: error,
      });
    }
    // @ts-ignore
    throw new Error('未知错误:' + error.message, { cause: error });
  }
};
