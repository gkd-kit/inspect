import type { RpcError } from './types.ts';

export class RpcException extends Error {
  readonly code: string;
  readonly serverStackTrace?: string;
  readonly path?: string;

  constructor(error: RpcError) {
    super(error.message);
    this.name = 'RpcException';
    this.code = error.code;
    this.serverStackTrace = error.stackTrace ?? undefined;
    this.path = error.path ?? undefined;
  }
}

/** Leaves successful bodies untouched; callers choose JSON or binary decoding. */
export async function readRpcResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const status = response.headers.get('GKD-RPC-Status');
  if (status === 'ok') return response;
  if (status === 'error') {
    let error: unknown;
    try {
      error = await response.json();
    } catch (cause) {
      throw new Error('RPC 错误响应不是有效 JSON', { cause });
    }
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      typeof error.code !== 'string' ||
      !('message' in error) ||
      typeof error.message !== 'string'
    ) {
      throw new Error('RPC 错误响应缺少 code 或 message');
    }
    const stackTrace = 'stackTrace' in error ? error.stackTrace : undefined;
    if (stackTrace != null && typeof stackTrace !== 'string') {
      throw new Error('RPC 错误响应的 stackTrace 不是字符串');
    }
    const path = 'path' in error ? error.path : undefined;
    if (path != null && typeof path !== 'string') {
      throw new Error('RPC 错误响应的 path 不是字符串');
    }
    throw new RpcException({
      code: error.code,
      message: error.message,
      stackTrace,
      path,
    });
  }
  if (status !== null) {
    throw new Error(`未知 RPC 状态: ${status}`);
  }

  // Older GKD servers signal errors only in the JSON body.
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const error: unknown = await response.clone().json();
    if (
      typeof error === 'object' &&
      error !== null &&
      '__error' in error &&
      error.__error === true
    ) {
      if (!('message' in error) || typeof error.message !== 'string') {
        throw new Error('旧版 RPC 错误响应缺少 message');
      }
      throw new RpcException({ code: 'LEGACY_ERROR', message: error.message });
    }
  }
  return response;
}
