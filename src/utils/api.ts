import { message } from './discrete';
import { enhanceFetch } from './fetch';

type RpcOptions = {
  query?: Record<string, unknown>;
  init?: RequestInit;
};

export const useDeviceApi = (initOrigin?: string) => {
  const origin = shallowRef(initOrigin);
  const rpc = async (rpcName: string, options: RpcOptions = {}) => {
    if (!origin.value) {
      throw new Error(`origin must exist`);
    }
    const u = new URL(`/api/` + rpcName, origin.value);
    Object.entries(options.query || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      u.searchParams.set(key, String(value));
    });
    const response = await enhanceFetch(u, options.init).catch((e) => {
      message.error(`网络错误:/` + rpcName);
      throw e;
    });
    if (!response.ok) {
      message.error(`接口错误:/` + rpcName + `:` + response.status);
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
  const jsonRpc = async <T>(...args: Parameters<typeof rpc>) => {
    const response = await rpc(...args);
    return (await response.json()) as T;
  };
  const blobRpc = async (...args: Parameters<typeof rpc>) => {
    const response = await rpc(...args);
    return await response.blob();
  };
  const arrayBufferRpc = async (...args: Parameters<typeof rpc>) => {
    const response = await rpc(...args);
    return await response.arrayBuffer();
  };
  const api = {
    device: async () => jsonRpc<Device>(`device`),
    snapshot: async (query?: { id?: string | number }) => {
      return jsonRpc<Snapshot>(`snapshot`, { query });
    },
    screenshot: async (query: { id: string | number }) => {
      return arrayBufferRpc(`screenshot`, { query });
    },
    captureSnapshot: async () => {
      return jsonRpc<Snapshot>(`captureSnapshot`);
    },
    snapshots: async () => {
      return jsonRpc<Snapshot[]>(`snapshots`);
    },
    updateSubsApps: async (data: unknown[]) => {
      return blobRpc(`updateSubsApps`, {
        init: {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      });
    },
    updateSubscription: async (data: any) => {
      return blobRpc(`updateSubscription`, {
        init: {
          method: 'POST',
          body: JSON.stringify({
            ...data,
            id: -1,
            name: '内存订阅',
            version: 0,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      });
    },
    execSelector: async (data: {
      selector: string;
      action?: string;
      quickFind?: boolean;
      fastQuery?: boolean;
    }) => {
      data = structuredClone(data);
      data.action ||= undefined;
      return jsonRpc<{ message: string; action: string; result: boolean }>(
        `execSelector`,
        {
          init: {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
              'Content-Type': 'application/json',
            },
          },
        },
      );
    },
  };
  return { origin, api };
};
