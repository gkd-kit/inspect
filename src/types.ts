import type { VNode } from 'vue';

export type WindowData = {
  appId: string;
  activityId: string;
  nodes: NodeData[];
};
export type NodeData = {
  id: number;
  pid: number;
  attr: AttrData;
};

export type AttrData = {
  id: string | null;
  className: string;
  childCount: number;
  isClickable: boolean;
  left: number;
  top: number;
  right: number;
  bottom: number;
  depth: number;
  index: number;
};

export type NodeX = {
  value: NodeData;
  children: NodeX[];
  parent?: NodeX;
  key: number;
  label: string;
  isLeaf?: boolean;
  prefix?: () => VNode;
};

export type RpcError = {
  message: string;
  code: number;
  __error: true;
};
export type SizeX = {
  height: number;
  width: number;
};

export type RectX = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type WindowX = {
  appId: string;
  activityId: string;
  node: NodeX;
};
