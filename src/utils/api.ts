import { message } from './discrete';
import { enhanceFetch } from './fetch';
import type { GmXhrOptions } from './gm';

interface Reqid {
  id: number;
}

export const useDeviceApi = (initOrigin?: string) => {
  const origin = shallowRef(initOrigin);
  const serverInfo = shallowRef<ServerInfo>();
  const request = async (
    name: string,
    init?: RequestInit,
    xhrDetails?: (arg: GmXhrOptions) => GmXhrOptions,
  ) => {
    if (!origin.value) {
      throw new Error(`origin must exist`);
    }
    const u = new URL(`/api/` + name, origin.value);
    const response = await enhanceFetch(u, init, xhrDetails).catch((e) => {
      message.error(`网络错误:` + name);
      throw e;
    });
    if (!response.ok) {
      message.error(`接口错误:` + name + `:` + response.status);
      throw response;
    }
    if (response.headers.get(`Content-Type`)?.includes(`application/json`)) {
      const error = (await response.clone().json()) as RpcError;
      if (error.__error) {
        message.error(error.message);
        throw response;
      }
    }
    return response;
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
      if (serverInfo.value?.gkdAppInfo?.versionName === '1.10.4') {
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
      return jsonRpc(`updateSubscription`, {
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
  };
  return { origin, api, serverInfo };
};
