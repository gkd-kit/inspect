export interface DeviceInfo {
  device: string;
  model: string;
  manufacturer: string;
  brand: string;
  sdkInt: number;
  release: string;
  /** @deprecated use gkdAppInfo instead */
  gkdVersionCode?: number;
  /** @deprecated use gkdAppInfo instead */
  gkdVersionName?: string;
}

export interface RawNode {
  id: number;
  pid: number;
  quickFind?: boolean;
  idQf?: boolean;
  textQf?: boolean;
  attr: RawAttr;
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

export interface AppInfo {
  id: string;
  name: string;
  versionCode: number;
  versionName?: string;
  isSystem: boolean;
  mtime: number;
  hidden: boolean;
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
  /** @deprecated use appInfo instead */
  appName?: string;
  /** @deprecated use appInfo instead */
  appVersionName?: string;
  /** @deprecated use appInfo instead */
  appVersionCode?: number;
}

export interface Snapshot extends Overview {
  device: DeviceInfo;
  nodes: RawNode[];
}
