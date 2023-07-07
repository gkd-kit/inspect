import type { VNode } from 'vue';

export type PrimitiveType = boolean | string | number | null | undefined;

export type RpcError = {
  message: string;
  code: number;
  __error: true;
};

export type Device = {
  device: string;
  model: string;
  manufacturer: string;
  brand: string;
  sdkInt: number;
  release: string;
};

export type RawNode = {
  id: number;
  pid: number;
  attr: RawAttr;

  // list to tree
  parent?: RawNode;
  children: RawNode[];
};

export type RawAttr = {
  id?: string;
  name: string;
  text?: string;
  textLen?: number;
  desc?: string;
  descLen?: number;
  isClickable: boolean;
  childCount: number;
  index: number;
  depth: number;

  left: number;
  top: number;
  right: number;
  bottom: number;
  _id?: number;
  _pid?: number;
};

export type Overview = {
  id: number;
  screenWidth: number;
  screenHeight: number;
  appId: string;
  appName: string;
  appVersionName: string;
  appVersionCode: number;
  activityId: string;
  isLandscape: boolean;
};

export type Snapshot = Overview &
  Device & {
    nodes: RawNode[];
  };

// export type SnapshotExt = Snapshot & {
//   node: NaiveNode;
// };

// export type NaiveNode = {
//   value: RawNode;
//   children: NaiveNode[];
//   parent?: NaiveNode;
//   key: number;
//   label: string;
//   isLeaf?: boolean;
//   prefix?: () => VNode;
// };

export type RectX = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type SizeExt = {
  height: number;
  width: number;
};
