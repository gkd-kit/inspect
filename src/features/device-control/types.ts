import type { AppInfo, DeviceInfo } from '@/entities/snapshot/types';

export interface RpcSuccess {
  message: 'success';
}

export interface RpcError {
  message: string;
  code: string;
  stackTrace?: string | null;
  path?: string | null;
}

export interface ServerInfo {
  device: DeviceInfo;
  gkdAppInfo: AppInfo;
}
