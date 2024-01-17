import type { Device, RawNode, SizeExt, Snapshot } from './types';

export const listToTree = (nodes: RawNode[]) => {
  // nodes = structuredClone(nodes);
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

export const xyInNode = (node: RawNode, ox: number, oy: number) => {
  const attr = node.attr;
  return (
    attr.left <= ox && ox <= attr.right && attr.top <= oy && oy <= attr.bottom
  );
};

export const inBoxNode = (box: RawNode, child: RawNode) => {
  return (
    box.attr.left <= child.attr.left &&
    box.attr.top <= child.attr.top &&
    box.attr.right >= child.attr.right &&
    box.attr.bottom >= child.attr.bottom
  );
};
export const findNodeByXy = (nodes: RawNode[], ox: number, oy: number) => {
  let prevNode: RawNode | undefined = void 0;
  nodes.forEach((node) => {
    if (node?.attr?.left === void 0) return;
    if (!xyInNode(node, ox, oy)) return;
    if (!prevNode) {
      prevNode = node;
      return;
    }
    if (inBoxNode(prevNode, node)) {
      prevNode = node;
    }
  });
  return prevNode as RawNode | undefined;
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

const labelKey = Symbol(`labelKey`);
export const getNodeLabel = (node: RawNode): string => {
  if (Reflect.has(node, labelKey)) {
    return Reflect.get(node, labelKey);
  }
  let label = node.attr.name?.split(`.`)?.at(-1) || ``;
  const length = node.children.length;
  if (length > 1) {
    label = `${label} [${length}]`;
  }
  if (node.attr.text) {
    label = `${label} : ${node.attr.text}`;
  } else if (node.attr.desc) {
    label = `${label} : ${node.attr.desc}`;
  }
  Reflect.set(node, labelKey, label);
  return label;
};
export const getLimitLabel = (node: RawNode, limit = 15): string => {
  let label = node.attr.name?.split(`.`)?.at(-1) || ``;
  const length = node.children.length;
  if (length > 1) {
    label = `${label} [${length}]`;
  }
  const text = node.attr.text || node.attr.desc || ``;
  if (text) {
    if (text.length > limit) {
      return `${label} : ${text.slice(0, limit)}...`;
    }
    return `${label} : ${text}`;
  }
  return label;
};

export const getDevice = (snapshot: Snapshot) => {
  if (typeof snapshot.device == 'object' && snapshot.device) {
    return snapshot.device;
  }
  return snapshot as unknown as Device;
};
