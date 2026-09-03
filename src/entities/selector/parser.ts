import type { RawNode } from '@/entities/snapshot/types';
import {
  getBooleanInvoke,
  getIntInvoke,
  getStringAttr,
  getStringInvoke,
  initDefaultTypeInfo,
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
import { isRawNode } from '../snapshot/node.ts';

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
  (node) => node.parent || null,
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
  findAst: <T>(v: T) => AstNode<T>;
  match: (node: RawNode) => RawNode | undefined;
  querySelfOrSelectorAll: (node: RawNode | undefined) => RawNode[];
  querySelfOrSelectorAllContext: (
    node: RawNode | undefined,
  ) => QueryResult<RawNode>[];
}

const typeInfo = initDefaultTypeInfo(true).globalType;
const matchOption = new MatchOption(false);

export const normalizeSelectorErrorIndex = (
  source: string,
  index: unknown,
): number | undefined => {
  if (typeof index != 'number' || !Number.isFinite(index) || !source.length) {
    return undefined;
  }
  return Math.min(Math.max(Math.trunc(index), 0), source.length - 1);
};

export const parseSelector = (source: string): ResolvedSelector => {
  const ast = Selector.Companion.parseAst(source);
  const value = ast.value;
  value.checkType(typeInfo);
  const binaryExpressionList = Array.from(
    value.expression.binaryExpressionList.asJsReadonlyArrayView(),
  );
  const fastQueryList = Array.from(
    value.expression.fastQueryList.asJsReadonlyArrayView(),
  );
  const connectSegmentList = Array.from(
    value.expression.connectSegmentList.asJsReadonlyArrayView(),
  );
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
    findAst,
    match(node) {
      return value.match(node, transform, matchOption) ?? undefined;
    },
    querySelfOrSelectorAll(node) {
      if (!node) return [];
      return (selector.match(node) ? [node] : []).concat(
        transform.querySelectorAllArray(node, value),
      );
    },
    querySelfOrSelectorAllContext(node) {
      if (!node) return [];
      const r = value.matchContext(node, transform, matchOption);
      return (r.matched ? [r] : []).concat(
        transform.querySelectorAllContextArray(node, value),
      );
    },
  };
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
