import type { NaiveNode, RawNode, SizeExt } from '@/utils/types';
import { h } from 'vue';

export const toSelectorLiteral = (
  s: string | number | null | boolean,
): string => {
  if (typeof s == 'string') {
    const s2 = JSON.stringify(s);
    const s3 = s2.substring(1, s2.length - 1).replaceAll('`', '\\`');
    return '`' + s3 + '`';
  }
  return String(s);
};

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

export function* traverseNode(node: NaiveNode, skipKeys: number[] = []) {
  const stack: NaiveNode[] = [];
  stack.push(node);
  while (stack.length > 0) {
    const top = stack.pop()!;
    if (skipKeys.includes(top.key)) {
      continue;
    }
    yield top;
    stack.push(...[...top.children].reverse());
  }
}

export const toNodeTree = (nodes: RawNode[]) => {
  const nodeXs = nodes.map<NaiveNode>((n) => {
    n.attr.name ??= n.attr.className;
    let label = n.attr.name?.split(`.`)?.at(-1) ?? ``;
    if (n.attr.text) {
      label = `${label} : ${n.attr.text}`;
    } else if (n.attr.desc) {
      label = `${label} : ${n.attr.desc}`;
    }
    return {
      value: n,
      children: [],
      key: n.id,
      label,
      prefix:
        n.attr.childCount > 0
          ? () => h('div', n.attr.childCount.toString())
          : undefined,
    };
  });
  nodeXs.forEach((node) => {
    node.value.attr._id = node.value.id;
    node.value.attr._pid = node.value.pid;
    node.parent = nodeXs[node.value.pid];
    if (node.parent) {
      node.value.attr.index = node.parent.children.length;
      node.parent.children.push(node);
    }
  });
  nodeXs.forEach((node) => {
    let n = node;
    let depth = 0;
    while (n.parent) {
      depth++;
      n = n.parent;
    }
    node.value.attr.depth = depth;

    node.isLeaf = node.children.length == 0;
  });
  return nodeXs[0];
};

export const xyInNode = (nodeX: NaiveNode, ox: number, oy: number) => {
  const attr = nodeX.value.attr;
  return (
    attr.left <= ox && ox <= attr.right && attr.top <= oy && oy <= attr.bottom
  );
};
