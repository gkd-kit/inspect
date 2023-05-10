import type { NodeData, NodeX, SizeX } from '@/utils/types';
import { h, ref } from 'vue';

export const toGkdLiteral = (s: string | number | null | boolean): string => {
  if (typeof s == 'string') {
    const s2 = JSON.stringify(s);
    const s3 = s2.substring(1, s2.length - 1).replaceAll('`', '\\`');
    return '`' + s3 + '`';
  }
  return String(s);
};

export const getImageSize = async (src: string) => {
  return new Promise<SizeX>((res, rej) => {
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

export function* traverseNode(node: NodeX, skipKeys: number[] = []) {
  const stack: NodeX[] = [];
  stack.push(node);
  while (stack.length > 0) {
    const top = stack.pop()!;
    if (skipKeys.includes(top.key)) {
      continue;
    }
    yield top;
    stack.push(...top.children);
  }
}

export const toNodeTree = (nodes: NodeData[]) => {
  const nodeXs = nodes.map<NodeX>((n) => {
    let label = n.attr.className.split(`.`).at(-1) ?? ``;
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

export const xyInNode = (nodeX: NodeX, ox: number, oy: number) => {
  const attr = nodeX.value.attr;
  return (
    attr.left <= ox && ox <= attr.right && attr.top <= oy && oy <= attr.bottom
  );
};
export const delay = async (n = 0) => {
  return new Promise<void>((res) => {
    setTimeout(res, n);
  });
};

export const useThrottle = <T extends (...args: any[]) => Promise<void>>(
  fn: T,
  miniInterval = 0,
  handler?: (error: any) => void
) => {
  const loadingRef = ref(false);
  return {
    get loading() {
      return loadingRef.value;
    },
    invoke: async (...args: Parameters<T>) => {
      if (loadingRef.value) {
        return;
      }
      loadingRef.value = true;
      await fn(...args).catch((e) => {
        if (handler) {
          handler(e);
        } else {
          console.error(e);
        }
      });
      await delay(miniInterval);
      loadingRef.value = false;
    },
  };
};
