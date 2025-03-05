import type {
  AppInfo,
  Device,
  Position,
  RawNode,
  SizeExt,
  Snapshot,
} from './types';

// 获取元素id最后一个.后面的内容
const getShortName = (fullName: string): string => {
  let lstIndex = fullName.lastIndexOf('.');
  if (lstIndex === -1) {
    return fullName;
  }
  return fullName.slice(lstIndex + 1);
};

const getConnectOperator = (operator: string, index: number): string => {
  return operator + (index === 1 ? '' : index);
};

export const getNodeSelectorText = (
  curNode: RawNode /* 当前节点 */,
  isFirst: boolean = true /* 调用时须省略 */,
  lastIndex: number = 1 /* 调用时须省略 */,
): string => {
  // 先处理递归基
  if (!curNode.parent) {
    // 当前节点为根节点
    if (isFirst) {
      return '[parent=null]';
    } else {
      return [getConnectOperator('<', lastIndex), '[parent=null]'].join(' ');
    }
  }
  if (curNode.idQf) {
    // 可以快速查询
    // （依赖页面结构而不是文本内容，只处理idQf的情况）
    const key = curNode.attr.vid ? 'vid' : 'id';
    const value = curNode.attr.vid || curNode.attr.id;
    if (isFirst) {
      return `[${key}="${value}"]`;
    } else {
      return [getConnectOperator('<', lastIndex), `[${key}="${value}"]`].join(
        ' ',
      );
    }
  }
  if (isFirst) {
    return [
      '@' + getShortName(curNode.attr.name),
      getNodeSelectorText(curNode.parent, false, curNode.attr.index + 1),
    ].join(' ');
  }
  return [
    getConnectOperator('<', lastIndex),
    getShortName(curNode.attr.name),
    getNodeSelectorText(curNode.parent, false, curNode.attr.index + 1),
  ].join(' ');
};

export const listToTree = (nodes: RawNode[]) => {
  nodes.forEach((node) => {
    node.attr ??= { name: `NULL` } as any;
    node.children ??= [];
    node.parent = nodes[node.pid];
    if (node.parent) {
      node.attr.index ??= node.parent.children.length;
      node.parent?.children.push(node);
    }
    Object.defineProperty(node, 'isLeaf', {
      get() {
        return node.children.length == 0;
      },
    });
    node.attr.depth = (node.parent?.attr?.depth ?? -1) + 1;
    node.attr._id ??= node.id;
    node.attr._pid ??= node.pid;
  });
  return nodes[0];
};

const xyInNode = (node: RawNode, position: Position) => {
  const attr = node.attr;
  const { x, y } = position;
  return attr.left <= x && x <= attr.right && attr.top <= y && y <= attr.bottom;
};

const includesRectNode = (outer: RawNode, inner: RawNode) => {
  return (
    outer.attr.left <= inner.attr.left &&
    outer.attr.top <= inner.attr.top &&
    outer.attr.right >= inner.attr.right &&
    outer.attr.bottom >= inner.attr.bottom
  );
};

const equalRectNode = (a: RawNode, b: RawNode) => {
  return (
    a.attr.left === b.attr.left &&
    a.attr.top === b.attr.top &&
    a.attr.right === b.attr.right &&
    a.attr.bottom === b.attr.bottom
  );
};

const isAncestor = (parent: RawNode | undefined, child: RawNode): boolean => {
  if (parent?.children?.length === 0) {
    return false;
  }
  let p = child.parent;
  while (true) {
    if (p?.id === parent?.id) return true;
    p = p?.parent;
    if (!p) break;
  }
  return false;
};

export const findNodesByXy = (
  nodes: RawNode[] | undefined,
  position: Position | undefined,
): RawNode[] => {
  if (!nodes || !position) return [];
  let results: RawNode[] = [];
  for (const node of nodes) {
    if (node?.attr?.left === undefined) continue;
    if (!xyInNode(node, position)) continue;
    results.push(node);
  }
  if (results.length <= 1) {
    return results;
  }

  // remove ancestor node
  results = results.filter((node) => {
    return !results.some(
      (other) => isAncestor(node, other) && includesRectNode(node, other),
    );
  });
  if (results.length <= 1) {
    return results;
  }

  // remove includes node
  results = results.filter((node) => {
    return !results.some(
      (other) =>
        node != other &&
        // ancestor https://i.gkd.li/i/17451180
        // uncle https://i.gkd.li/i/14881985
        (isAncestor(node, other) || isAncestor(node.parent, other)) &&
        includesRectNode(node, other) &&
        !equalRectNode(node, other),
    );
  });
  results.sort((a, b) => {
    return getNodeArea(a) - getNodeArea(b);
  });
  return results;
};

const getNodeArea = (node: RawNode) => {
  const w = node.attr.width ?? node.attr.right - node.attr.left;
  const h = node.attr.height ?? node.attr.bottom - node.attr.top;
  return w * h;
};

export function* traverseNode(node: RawNode, skipKeys: number[] = []) {
  const stack: RawNode[] = [];
  stack.push(node);
  while (stack.length > 0) {
    const top = stack.pop()!;
    if (skipKeys.includes(top.id)) {
      continue;
    }
    yield top;
    stack.push(...[...top.children].reverse());
  }
}

function* traverseDescendants(node: RawNode) {
  const stack = node.children.toReversed();
  while (stack.length > 0) {
    const top = stack.pop()!;
    yield top;
    stack.push(...top.children.toReversed());
  }
}

export const getImageSize = async (src: string) => {
  return new Promise<SizeExt>((res, rej) => {
    const img = new Image();
    img.onload = () => {
      res({
        height: img.naturalHeight,
        width: img.naturalWidth,
      });
    };
    img.onerror = rej;
    img.src = src;
  });
};
const getSafeName = (node: RawNode) => {
  const c = node.attr.childCount;
  return (node.attr.name || `🐔` + (c > 1 ? `` : ` [${c}]`)).split('.').at(-1)!;
};
const getLabelSuffix = (node: RawNode) => {
  return node.attr.text || node.attr.desc || node.attr.vid || node.attr.id;
};
const labelKey = Symbol(`labelKey`);
export const getNodeLabel = (node: RawNode): string => {
  if (Reflect.has(node, labelKey)) {
    return Reflect.get(node, labelKey);
  }
  let label = getSafeName(node);
  const length = node.children.length;
  if (length > 1) {
    label = `${label} [${length}]`;
  }
  const text = getLabelSuffix(node);
  if (text) {
    // if (text.length > labelLimit) {
    //   label = `${label} : ${text.slice(0, labelLimit)}...`;
    // } else {
    //   label = `${label} : ${text}`;
    // }
    label = `${label} : ${text}`;
  }
  Reflect.set(node, labelKey, label);
  return label;
};
export const getLimitLabel = (node: RawNode, limit = 15): string => {
  let label = getSafeName(node);
  const length = node.children.length;
  if (length > 1) {
    label = `${label} [${length}]`;
  }
  const text = getLabelSuffix(node);
  if (text) {
    if (text.length > limit) {
      return `${label} : ${text.slice(0, limit)}...`;
    }
    return `${label} : ${text}`;
  }
  return label;
};

export const getDevice = (snapshot: Snapshot): Device => {
  if (typeof snapshot.device == 'object' && snapshot.device) {
    return snapshot.device;
  }
  return snapshot as unknown as Device;
};

export const getAppInfo = (snapshot: Snapshot): AppInfo => {
  return (
    snapshot.appInfo || {
      id: snapshot.appId,
      name: snapshot.appName,
      versionCode: snapshot.appVersionCode,
      versionName: snapshot.appVersionName,
      hidden: false,
      isSystem: false,
      mtime: Date.now(),
    }
  );
};

export const getGkdAppInfo = (snapshot: Snapshot): AppInfo => {
  const device = getDevice(snapshot);
  return (
    snapshot.gkdAppInfo || {
      id: 'li.songe.gkd',
      name: 'GKD',
      versionCode: device.gkdVersionCode,
      versionName: device.gkdVersionName,
      hidden: false,
      isSystem: false,
      mtime: Date.now(),
    }
  );
};

export const isRawNode = (node: any): node is RawNode => {
  if (
    node &&
    typeof node === 'object' &&
    typeof node.id === 'number' &&
    node.attr
  ) {
    return true;
  }
  return false;
};

export const getNodeStyle = (node: RawNode, focusNode?: RawNode) => {
  const qf = Boolean(node.idQf || node.textQf || node.quickFind);
  const fontWeight = qf ? 'bold' : undefined;
  const color = node.id === focusNode?.id ? '#00F' : undefined;
  return {
    fontWeight,
    color,
  };
};

const nodeCompareFn = (a: RawNode, b: RawNode) => {
  return a.id - b.id;
};

const getTopNode = (nodes: RawNode[], subNodes: RawNode[]): RawNode => {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (
      node.children.length &&
      subNodes.every((n) => node === n || isAncestor(node, n))
    ) {
      return node;
    }
  }
  throw new Error('no top node');
};

const emptyArray = [] as [];

export interface TrackTreeContext {
  topNode: RawNode;
  getLabel: (node: RawNode) => string;
  getChildren: (node: RawNode) => RawNode[];
  isPlaceholder: (node: RawNode) => boolean;
}

export const getTrackTreeContext = (
  nodes: RawNode[],
  subNodes: RawNode[],
): TrackTreeContext => {
  const topNode = getTopNode(nodes, subNodes);
  const minTreeNodes = new Set([topNode, ...subNodes]);
  const stack = topNode.children.toReversed();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (subNodes.some((n) => isAncestor(node, n))) {
      minTreeNodes.add(node);
      stack.push(...node.children.toReversed());
    }
  }
  const brotherPlaceholderNodes = new Set<RawNode>();
  const descendantPlaceholderNodes = new Map<RawNode, RawNode | undefined>();
  const getLabel = (node: RawNode): string => {
    if (brotherPlaceholderNodes.has(node)) {
      const children = node.parent?.children || emptyArray;
      const i = children.indexOf(node);
      const lastNode =
        children.find((n, i2) => {
          return (
            i2 > i && !minTreeNodes.has(n) && minTreeNodes.has(children[i2 + 1])
          );
        }) || children.at(-1)!;
      return `[${i} ~ ${lastNode.attr.index}]`;
    }
    if (descendantPlaceholderNodes.get(node)) {
      return `[ ... ]`;
    }

    return getLimitLabel(node);
  };
  const getOnlyDescendant = (node: RawNode): RawNode | undefined => {
    const n1 = node.children.find(
      (n) => minTreeNodes.has(n) && !subNodes.includes(n),
    );
    if (!n1) return;
    if (
      node.children.some(
        (n) => n !== n1 && (subNodes.includes(n) || minTreeNodes.has(n)),
      )
    ) {
      return;
    }
    return getOnlyDescendant(n1) || n1;
  };
  const childrenCache = new Map<number, RawNode[]>();
  const getChildren = (node: RawNode): RawNode[] => {
    if (node.children.every((n) => !minTreeNodes.has(n))) {
      return emptyArray;
    }
    if (descendantPlaceholderNodes.has(node)) {
      const c = descendantPlaceholderNodes.get(node);
      if (c) {
        return [c];
      }
    } else if (!subNodes.includes(node)) {
      const onlyDescendant = getOnlyDescendant(node);
      if (onlyDescendant && !node.children.includes(onlyDescendant)) {
        descendantPlaceholderNodes.set(node, onlyDescendant);
        return [onlyDescendant];
      } else {
        descendantPlaceholderNodes.set(node, undefined);
      }
    }
    if (node.children.length <= 1) {
      return node.children;
    }
    if (childrenCache.get(node.id)) {
      return childrenCache.get(node.id)!;
    }
    const list: RawNode[] = [];
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const prev = node.children[i - 1];
      const next = node.children[i + 1];
      if (minTreeNodes.has(child)) {
        list.push(child);
      } else if (
        (!prev || minTreeNodes.has(prev)) &&
        node.children.some((n, i2) => i2 > i && minTreeNodes.has(n))
      ) {
        list.push(child);
        if (next && !minTreeNodes.has(next)) {
          brotherPlaceholderNodes.add(child);
        }
      }
    }
    childrenCache.set(node.id, list);
    return list;
  };
  const isPlaceholder = (node: RawNode) => {
    return (
      brotherPlaceholderNodes.has(node) ||
      Boolean(descendantPlaceholderNodes.get(node))
    );
  };
  return {
    topNode,
    getLabel,
    getChildren,
    isPlaceholder,
  };
};

export const getNodeQf = (node: RawNode): boolean => {
  return Boolean(node.idQf || node.textQf || node.quickFind);
};
