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
  text?: string;
  desc?: string;
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

export type Snapshot = {
  id: number;
  device: string;
  versionRelease: string;
  model: string;
  manufacturer: string;
  androidVersion: string;
  appId: string;
  appName: string;
  activityId: string;
  comment: string;
};
// {
//   id: 1677839140151,
//   device: 'alioth',
//   versionRelease: '12',
//   model: 'M2012K11AC',
//   manufacturer: 'Xiaomi',
//   androidVersion: 31,
//   appId: 'li.songe.gkd.debug',
//   appName: '搞快点-dev',
//   activityId: 'li.songe.gkd.MainActivity',
// };

export type Device = {
  device: string;
  model: string;
  manufacturer: string;
  brand: string;
  sdkInt: number;
  release: string;
};
/*
{
  "device": "diting",
  "model": "22081212C",
  "manufacturer": "Xiaomi",
  "brand": "Redmi",
  "sdkInt": 33,
  "release": "13"
}
*/
