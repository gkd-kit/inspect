import type { GkdSelector } from '@/utils/selector';

export type PrimitiveType = boolean | string | number | null | undefined;

export interface RpcError {
  message: string;
  code: number;
  __error: true;
}

export interface Device {
  device: string;
  model: string;
  manufacturer: string;
  brand: string;
  sdkInt: number;
  release: string;

  /**
   * @deprecated use gkdAppInfo instead
   */
  gkdVersionCode?: number;
  /**
   * @deprecated use gkdAppInfo instead
   */
  gkdVersionName?: string;
}

export interface RawNode {
  id: number;
  pid: number;
  quickFind?: boolean;
  idQf?: boolean;
  textQf?: boolean;
  attr: RawAttr;

  // list to tree
  parent?: RawNode;
  children: RawNode[];
}

export interface RawAttr {
  id?: string;
  vid?: string;
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
  width: number;
  height: number;
  _id?: number;
  _pid?: number;
}

export interface Overview {
  id: number;

  appId: string;
  activityId: string;

  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;

  appInfo: AppInfo;
  gkdAppInfo: AppInfo;

  /**
   * @deprecated use appInfo instead
   */
  appName?: string;
  /**
   * @deprecated use appInfo instead
   */
  appVersionName?: string;
  /**
   * @deprecated use appInfo instead
   */
  appVersionCode?: number;
}

export interface Snapshot extends Overview {
  device: Device;
  nodes: RawNode[];
}

export interface AppInfo {
  id: string;
  name: string;
  versionCode: number;
  versionName?: string;
  isSystem: boolean;
  mtime: number;
  hidden: boolean;
}

export interface RectX {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface SizeExt {
  height: number;
  width: number;
}

export interface Position {
  x: number;
  y: number;
}

export type TrackValue = {
  selector: GkdSelector;
  nodes: RawNode[];
};
