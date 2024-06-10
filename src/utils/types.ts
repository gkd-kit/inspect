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

  /**
   * @deprecated use gkdAppInfo instead
   */
  gkdVersionCode?: number;
  /**
   * @deprecated use gkdAppInfo instead
   */
  gkdVersionName?: string;
};

export type RawNode = {
  id: number;
  pid: number;
  quickFind?: boolean;
  idQf?: boolean;
  textQf?: boolean;
  attr: RawAttr;

  // list to tree
  parent?: RawNode;
  children: RawNode[];
};

export type RawAttr = {
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
  _id?: number;
  _pid?: number;
};

export type Overview = {
  id: number;

  appId: string;
  activityId: string;

  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;

  appInInfo: AppInfo;
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
};

export type Snapshot = Overview & {
  device: Device;
  nodes: RawNode[];
};

export type AppInfo = {
  id: string;
  name: string;
  versionCode: number;
  versionName?: string;
  isSystem: boolean;
  mtime: number;
  hidden: boolean;
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
