import type Sequence from 'sequency';
import { createSequence } from 'sequency';
import Selector from './Selector';

export default abstract class NodeExt {
  abstract parent?: NodeExt;
  abstract children: Sequence<void | NodeExt>;
  abstract name: string;
  abstract attr(name: string): unknown;

  getChild(offset: number): void | NodeExt {
    return this.children.elementAtOrNull(offset) ?? undefined;
  }
  get ancestors() {
    const { parent } = this;
    return createSequence<NodeExt>(
      (function* () {
        let parentVar = parent;
        while (parentVar != null) {
          yield parentVar;
          parentVar = parentVar.parent;
        }
      })(),
    );
  }
  getAncestor(offset: number): void | NodeExt {
    return this.ancestors.elementAtOrNull(offset) ?? undefined;
  }
  get beforeBrothers(): Sequence<NodeExt | void> {
    const _this = this;
    const { parent } = this;
    return createSequence(
      (function* () {
        if (!parent) return;
        const parentVal = parent;
        const list = parentVal.children.takeWhile((it) => it != _this).toList();
        list.reverse();
        for (const it of list) {
          yield it;
        }
      })(),
    );
  }
  getBeforeBrother(offset: number): void | NodeExt {
    return this.beforeBrothers.elementAtOrNull(offset) ?? undefined;
  }
  get afterBrothers(): Sequence<NodeExt | void> {
    const _this = this;
    const { parent } = this;
    return createSequence(
      (function* () {
        if (!parent) return;
        const parentVal = parent;
        const list = parentVal.children.dropWhile((it) => it != _this).drop(1);
        for (const it of list.asIterable()) {
          yield it;
        }
      })(),
    );
  }
  getAfterBrother(offset: number): void | NodeExt {
    return this.afterBrothers.elementAtOrNull(offset) ?? undefined;
  }
  // 深度优先先序遍历
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Document/querySelector
  get descendants(): Sequence<NodeExt> {
    const stack: NodeExt[] = [this];
    const list: NodeExt[] = [];
    return createSequence(
      (function* () {
        while (stack.length > 0) {
          const top = stack.pop()!;
          yield top;
          for (const childNode of top.children.asIterable()) {
            if (childNode) {
              list.push(childNode);
            }
          }

          if (list.length > 0) {
            list.reverse();
            stack.push(...list);
            while (list.length > 0) {
              list.pop();
            }
          }
        }
      })(),
    );
  }
  querySelector(selector: Selector | string): this | void {
    return (this.querySelectorAll(selector).firstOrNull() as this) ?? undefined;
  }
  querySelectorAll(selector: Selector | string): Sequence<this> {
    if (typeof selector == 'string') {
      selector = Selector.parse(selector);
    }
    const _this = this;
    return createSequence(
      (function* () {
        for (const node of _this.descendants.asIterable()) {
          const r = selector.match(node) as typeof _this;
          if (r) {
            yield r;
          }
        }
      })(),
    );
  }
}
