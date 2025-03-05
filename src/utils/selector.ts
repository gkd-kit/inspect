import {
  getBooleanInvoke,
  getIntInvoke,
  getStringAttr,
  getStringInvoke,
  initDefaultTypeInfo,
  updateWasmToMatches,
  MatchOption,
  QueryResult,
  Transform,
  QueryContext,
  AstNode,
  Selector,
  FastQuery,
  BinaryExpression,
  CompareOperator,
  ConnectExpression,
  ConnectOperator,
  ConnectSegment,
  ConnectWrapper,
  Expression,
  LogicalExpression,
  LogicalOperator,
  LogicalSelectorExpression,
  NotExpression,
  PolynomialExpression,
  PropertySegment,
  ValueExpression,
  PropertyUnit,
  PropertyWrapper,
  SelectorExpression,
  SelectorLogicalOperator,
  TupleExpression,
  UnitSelectorExpression,
  NotSelectorExpression,
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

export const transform = Transform.Companion.multiplatformBuild<RawNode>(
  (target, name) => {
    if (typeof target === 'string') {
      return getStringAttr(target, name);
    }
    if (target instanceof QueryContext) {
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
    if (target instanceof QueryContext) {
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

export interface ResolvedSelector {
  source: string;
  ast: AstNode<Selector>;
  value: Selector;
  connectKeys: string[];
  fastQueryList: FastQuery[];
  canQf: boolean;
  canCopy: boolean;
  toString: () => string;
  match: (node: RawNode) => RawNode | undefined;
  querySelectorAll: (node: RawNode | undefined) => RawNode[];
  querySelectorAllContext: (
    node: RawNode | undefined,
  ) => QueryResult<RawNode>[];
  findAst: <T>(v: T) => AstNode<T>;
}

const typeInfo = initDefaultTypeInfo(true).globalType;
const matchOption = new MatchOption(false);

export const parseSelector = (source: string): ResolvedSelector => {
  const ast = Selector.Companion.parseAst(source);
  const value = ast.value;
  value.checkType(typeInfo);
  const binaryExpressionList =
    value.expression.binaryExpressionList.asJsReadonlyArrayView();
  const fastQueryList = value.expression.fastQueryList
    .asJsReadonlyArrayView()
    .concat();
  const connectSegmentList =
    value.expression.connectSegmentList.asJsReadonlyArrayView();
  const innerFindAst = <T>(t: AstNode<any>, v: T): AstNode<T> | undefined => {
    if (t.value === v) {
      for (const c of t.outChildren) {
        if (c.value === v) {
          return c;
        }
      }
      return t;
    }
    for (const c of t.outChildren) {
      const r = innerFindAst(c, v);
      if (r) return r;
    }
  };
  const findAst = <T>(v: T): AstNode<T> => {
    const r = innerFindAst(ast, v);
    if (r) return r;
    throw new Error('not found');
  };
  const selector: ResolvedSelector = {
    source,
    ast,
    value,
    connectKeys: connectSegmentList.map((v) => v.operator.key),
    canCopy: !binaryExpressionList.some((b) =>
      b.properties.some((p) => p.startsWith('_')),
    ),
    canQf: fastQueryList.length > 0,
    fastQueryList: fastQueryList,
    toString() {
      return value.toString();
    },
    match(node) {
      return value.match(node, transform, matchOption) ?? undefined;
    },
    querySelectorAll(node) {
      if (!node) return [];
      return transform.querySelectorAllArray(node, value);
    },
    querySelectorAllContext(node) {
      if (!node) return [];
      return transform.querySelectorAllContextArray(node, value);
    },
    findAst,
  };
  for (const exp of binaryExpressionList) {
    if (exp.operator.key == '~=' && !useGlobalStore().wasmSupported) {
      if (!useSettingsStore().ignoreWasmWarn) {
        useGlobalStore().wasmErrorDlgVisible = true;
        break;
      }
    }
  }
  return selector;
};

export const checkSelector = (source: string) => {
  return Selector.Companion.parseOrNull(source) != null;
};

// keep class name avoid minify
const clazzList = Object.entries({
  MatchOption,
  QueryResult,
  Transform,
  QueryContext,
  AstNode,
  Selector,
  FastQuery,
  BinaryExpression,
  CompareOperator,
  ConnectExpression,
  ConnectOperator,
  ConnectSegment,
  ConnectWrapper,
  Expression,
  LogicalExpression,
  LogicalOperator,
  LogicalSelectorExpression,
  NotExpression,
  PolynomialExpression,
  PropertySegment,
  ValueExpression,
  PropertyUnit,
  PropertyWrapper,
  SelectorExpression,
  SelectorLogicalOperator,
  TupleExpression,
  UnitSelectorExpression,
  NotSelectorExpression,
}).map(([k, v]) => ({
  clazz: v as any,
  name: k,
}));

clazzList.forEach((v) => {
  Object.keys(v.clazz).forEach((subClazzName) => {
    const clazz = v.clazz[subClazzName];
    if (clazz instanceof Function) {
      clazzList.push({ clazz, name: subClazzName });
    }
  });
});

const getGkdInnerClassName = (clazz: any): string => {
  const c = clazzList.find((v) => v.clazz === clazz);
  if (c) return c.name;
  console.error('unknown class:', clazz);
  return '';
};

export const getAstNodeClassName = (node: AstNode<any>) => {
  const list = [node.name];
  let clazz = Object.getPrototypeOf(Object.getPrototypeOf(node.value));
  while (clazz?.constructor && clazz.constructor !== Object) {
    list.push(getGkdInnerClassName(clazz.constructor));
    clazz = Object.getPrototypeOf(clazz);
  }
  return list.join(' ');
};
