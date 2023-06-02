import { ref } from 'vue';
import { message } from './discrete';
import type { Device, RpcError, Snapshot } from './types';
import { enhanceFetch } from './fetch';
import { cacheStorage } from './storage';

export const useDeviceApi = (initOrigin?: string) => {
  const origin = ref(initOrigin);
  const rpc = async (rpcName: string, query: Record<string, unknown> = {}) => {
    if (!origin.value) {
      throw new Error(`origin must exist`);
    }
    const u = new URL(`/api/` + rpcName, origin.value);
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      u.searchParams.set(key, String(value));
    });
    const response = await enhanceFetch(u).catch((e) => {
      message.error(`网络错误:/` + rpcName);
      throw e;
    });
    if (!response.ok) {
      message.error(`接口错误:/` + rpcName + `:` + response.status);
      throw response;
    }
    const X_Rpc_Result = response.headers.get(`X_Rpc_Result`);
    if (X_Rpc_Result != `ok`) {
      const error = (await response.json()) as RpcError;
      message.error(error.message);
      throw response;
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
      return (
        (query?.id
          ? await cacheStorage.getItem<Snapshot>(`snapshot-` + query.id)
          : null) ??
        jsonRpc<Snapshot>(`snapshot`, query).then((r) => {
          cacheStorage.setItem(`snapshot-` + r.id, r);
          return r;
        })
      );
    },
    screenshot: async (query: { id: string | number }) => {
      const cacheKey = `screenshot-` + query.id;
      return (
        (await cacheStorage.getItem<ArrayBuffer>(cacheKey)) ??
        arrayBufferRpc(`screenshot`, query).then((r) => {
          cacheStorage.setItem(cacheKey, r);
          return r;
        })
      );
    },
    snapshotIds: async () => jsonRpc<number[]>(`snapshotIds`),
  };
  return { origin, api };
};
