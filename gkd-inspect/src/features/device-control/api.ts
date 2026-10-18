import { computed, shallowRef } from 'vue';
import type { Snapshot } from '@/entities/snapshot/types';
import type { RpcSuccess, ServerInfo } from '@/features/device-control/types';
import { readRpcResponse, RpcException } from './rpc';
import { message } from '@/shared/services/feedback';
import { enhanceFetch } from '@/features/network-access/enhanceFetch';
import type { GmXhrOptions } from '@/shared/api/gm';

interface Reqid {
  id: number;
}

const createDeviceApi = (
  origin: string | undefined,
  signal: AbortSignal,
  getServerInfo: () => ServerInfo | undefined,
) => {
  const request = async (
    name: string,
    init?: RequestInit,
    xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
  ) => {
    if (!origin) {
      throw new Error(`origin must exist`);
    }
    const u = new URL(`/api/` + name, origin);
    const response = await enhanceFetch(
      u,
      { ...init, signal },
      xhrDetails,
    ).catch((e) => {
      if (!(e instanceof DOMException && e.name == 'AbortError')) {
        message.error(`网络错误:` + name);
      }
      throw e;
    });
    return readRpcResponse(response).catch((error: unknown) => {
      message.error(
        error instanceof RpcException
          ? error.path
            ? `${error.path}: ${error.message}`
            : error.message
          : `接口错误:${name}:${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    });
  };
  const baseRpc = async (
    name: string,
    data: object = {},
    xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
  ) => {
    return request(
      name,
      {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
      xhrDetails,
    );
  };
  const jsonRpc = async <T>(name: string, data: object = {}): Promise<T> => {
    return baseRpc(name, data).then((r) => r.json());
  };
  const bfRpc = async (
    name: string,
    data: object = {},
  ): Promise<ArrayBuffer> => {
    return baseRpc(name, data, (v) => {
      // must set responseType to get binary data
      v.responseType = 'arraybuffer';
      return v;
    }).then((r) => r.arrayBuffer());
  };
  const api = {
    getServerInfo: async () => jsonRpc<ServerInfo>(`getServerInfo`),
    getSnapshot: async (data: Reqid): Promise<Snapshot> => {
      if (getServerInfo()?.gkdAppInfo?.versionName === '1.10.4') {
        // 兼容旧版本 BUG
        // https://github.com/gkd-kit/gkd/blob/v1.10.4/app/src/main/kotlin/li/songe/gkd/debug/HttpService.kt#L198
        return request('snapshot?id=' + data.id).then((r) => r.json());
      }
      return jsonRpc(`getSnapshot`, data);
    },
    getScreenshot: async (data: Reqid) => {
      return bfRpc(`getScreenshot`, data);
    },
    captureSnapshot: async () => jsonRpc<Snapshot>(`captureSnapshot`),
    getSnapshots: async () => jsonRpc<Snapshot[]>(`getSnapshots`),
    updateSubscription: async (data: any) => {
      return jsonRpc<RpcSuccess>(`updateSubscription`, {
        ...data,
        id: -1,
        name: '内存订阅',
        version: 0,
      });
    },
    execSelector: async (data: {
      selector: string;
      action?: string;
      fastQuery?: boolean;
    }) => {
      data = structuredClone(data);
      data.action ||= undefined;
      return jsonRpc<{ message: string; action: string; result: boolean }>(
        `execSelector`,
        data,
      );
    },
    deleteSnapshot: async (data: Reqid) => {
      return jsonRpc<RpcSuccess>(`deleteSnapshot`, data);
    },
  };
  return api;
};

export type DeviceApi = ReturnType<typeof createDeviceApi>;
export const useDeviceApi = () => {
  const connection = shallowRef<{
    origin: string;
    serverInfo: ServerInfo;
    api: DeviceApi;
    controller: AbortController;
  }>();
  const disconnectedApi = createDeviceApi(
    undefined,
    new AbortController().signal,
    () => undefined,
  );
  const prepareConnection = async (origin: string) => {
    const controller = new AbortController();
    let serverInfo: ServerInfo | undefined;
    const api = createDeviceApi(origin, controller.signal, () => serverInfo);
    try {
      const [info, snapshots] = await Promise.all([
        api.getServerInfo(),
        api.getSnapshots(),
      ]);
      serverInfo = info;
      return { origin, serverInfo: info, snapshots, api, controller };
    } catch (error) {
      controller.abort();
      throw error;
    }
  };
  const applyConnection = (value: NonNullable<typeof connection.value>) => {
    connection.value?.controller.abort();
    connection.value = value;
  };
  const disconnect = () => {
    connection.value?.controller.abort();
    connection.value = undefined;
  };
  return {
    origin: computed(() => connection.value?.origin),
    serverInfo: computed(() => connection.value?.serverInfo),
    api: computed(() => connection.value?.api ?? disconnectedApi),
    prepareConnection,
    applyConnection,
    disconnect,
  };
};
