import { NodeExt } from '@/selector_core';
import Sequence, { asSequence } from 'sequency';
import type { NaiveNode } from './types';

export class NodeOption extends NodeExt {
  _children: NodeOption[];

  constructor(
    public readonly value: NaiveNode,
    public readonly parent?: NodeOption,
  ) {
    super();
    this._children = value.children.map((c) => new NodeOption(c, this));
  }

  get children(): Sequence<NodeOption> {
    return asSequence(this._children);
  }

  get name(): string {
    return this.value.value.attr.name;
  }

  attr(name: string): unknown {
    // @ts-ignore
    return this.value.value.attr[name];
  }
}
