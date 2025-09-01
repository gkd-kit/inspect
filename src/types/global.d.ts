type PrimitiveType = boolean | string | number | null | undefined;

interface RpcError {
  message: string;
  code: number;
  __error: true;
}

interface DeviceInfo {
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

interface ServerInfo {
  device: DeviceInfo;
  gkdAppInfo: AppInfo;
}

interface RawNode {
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

interface RawAttr {
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

interface Overview {
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

interface Snapshot extends Overview {
  device: DeviceInfo;
  nodes: RawNode[];
}

interface AppInfo {
  id: string;
  name: string;
  versionCode: number;
  versionName?: string;
  isSystem: boolean;
  mtime: number;
  hidden: boolean;
}

interface RectX {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface SizeExt {
  height: number;
  width: number;
}

interface Position {
  x: number;
  y: number;
}

interface TrackCardProps {
  nodes: RawNode[];
  queryResult: import('@gkd-kit/selector').QueryResult<RawNode>;
  selector: import('@/utils/selector').ResolvedSelector;
}

interface SelectorSearchResult {
  gkd: true;
  key: number;
  selector: import('@/utils/selector').ResolvedSelector;
  nodes: RawNode[];
  results: import('@gkd-kit/selector').QueryResult<RawNode>[];
}
interface StringSearchResult {
  gkd: false;
  key: number;
  selector: string;
  nodes: RawNode[];
}

type SearchResult = SelectorSearchResult | StringSearchResult;

interface SettingsStore {
  autoUploadImport: boolean;
  ignoreUploadWarn: boolean;
  ignoreWasmWarn: boolean;
  maxShowNodeSize: number;
}

interface GlobalStore {
  networkErrorDlgVisible: boolean;
  githubErrorDlgVisible: boolean;
  wasmErrorDlgVisible: boolean;
  wasmSupported?: boolean;
}
