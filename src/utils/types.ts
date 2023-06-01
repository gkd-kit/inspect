import type { VNode } from 'vue';

export type PrimitiveType = string | number | null | undefined;

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

  /**
   * @deprecated use name
   */
  className: string;
};

export type Snapshot = {
  id: number;
  device: Device;
  screenWidth: number;
  screenHeight: number;
  appId: string;
  appName: string;
  activityId: string;
  nodes: RawNode[];
};

export type SnapshotExt = Snapshot & {
  node: NaiveNode;
};

export type NaiveNode = {
  value: RawNode;
  children: NaiveNode[];
  parent?: NaiveNode;
  key: number;
  label: string;
  isLeaf?: boolean;
  prefix?: () => VNode;
};

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
