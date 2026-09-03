import type { AppInfo, DeviceInfo } from '@/entities/snapshot/types';

export interface RpcError {
  message: string;
  code: number;
  __error: true;
}

export interface ServerInfo {
  device: DeviceInfo;
  gkdAppInfo: AppInfo;
}
