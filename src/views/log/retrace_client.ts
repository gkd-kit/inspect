import { getBuildAsset, getWorkersProxyUrl } from '../../utils/workers.ts';
import {
  getBuildAssetCache,
  removeBuildAssetCache,
  setBuildAssetCache,
} from './build_asset_cache.ts';
import { readLimitedResponse } from './response.ts';
import type {
  RetraceWorkerRequest,
  RetraceWorkerResponse,
} from './retrace.worker.ts';
import { hasRetraceableStack } from './retrace_text.ts';

export const MAX_BUILD_ASSET_ZIP_SIZE = 50 * 1024 * 1024;

type BuildAssetZip = {
  assetId: number;
  data: ArrayBuffer;
};

type WorkerRequest =
  | { type: `register`; data: ArrayBuffer }
  | { type: `retrace-crash`; text: string }
  | { type: `retrace-log`; text: string };

const getError = (error: unknown) => {
  return error instanceof Error ? error : new Error(String(error));
};

const downloadBuildAssetZip = async (assetId: number, signal: AbortSignal) => {
  const targetUrl = `https://f.gkd.li/${assetId}`;
  const proxyUrl = getWorkersProxyUrl(targetUrl);
  if (!proxyUrl) throw new Error(`无法生成构建附件下载地址`);
  const response = await fetch(proxyUrl, { credentials: `omit`, signal });
  if (!response.ok)
    throw new Error(`构建附件下载失败: HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get(`content-length`) || 0);
  if (declaredSize > MAX_BUILD_ASSET_ZIP_SIZE) {
    throw new Error(`构建附件 ZIP 超过大小限制`);
  }
  try {
    return await readLimitedResponse(response, MAX_BUILD_ASSET_ZIP_SIZE);
  } catch (error) {
    if (error instanceof Error && error.message == `响应内容超过大小限制`) {
      throw new Error(`构建附件 ZIP 超过大小限制`, { cause: error });
    }
    throw error;
  }
};

const loadBuildAssetZip = async (
  buildKey: string,
  signal: AbortSignal,
): Promise<BuildAssetZip> => {
  const asset = await getBuildAsset(buildKey, signal);
  if (!asset) throw new Error(`未找到该版本的构建附件`);
  signal.throwIfAborted();
  const cached = await getBuildAssetCache(asset.assetId);
  signal.throwIfAborted();
  if (cached) return { assetId: asset.assetId, data: cached.data };
  const data = await downloadBuildAssetZip(asset.assetId, signal);
  signal.throwIfAborted();
  await setBuildAssetCache(asset.assetId, data);
  signal.throwIfAborted();
  return { assetId: asset.assetId, data };
};

type SharedTaskLease<T> = {
  task: Promise<T>;
  release: () => void;
};

export const createSharedTaskPool = <T>(
  load: (key: string, signal: AbortSignal) => Promise<T>,
) => {
  const tasks = new Map<
    string,
    {
      task: Promise<T>;
      controller: AbortController;
      consumers: number;
      settled: boolean;
    }
  >();
  return (key: string): SharedTaskLease<T> => {
    let entry = tasks.get(key);
    if (!entry) {
      const controller = new AbortController();
      const task = load(key, controller.signal);
      entry = { task, controller, consumers: 0, settled: false };
      tasks.set(key, entry);
      void task
        .finally(() => {
          entry!.settled = true;
          if (tasks.get(key) == entry) tasks.delete(key);
        })
        .catch(() => {});
    }
    entry.consumers++;
    let released = false;
    return {
      task: entry.task,
      release: () => {
        if (released) return;
        released = true;
        entry!.consumers--;
        if (!entry!.settled && entry!.consumers == 0) {
          entry!.controller.abort();
        }
      },
    };
  };
};

const acquireBuildAssetZipTask = createSharedTaskPool(loadBuildAssetZip);

export class LazyBuildRetracer {
  readonly buildKey: string;
  private worker: Worker | undefined;
  private workerReadyTask: Promise<void> | undefined;
  private rejectWorkerReady: ((error: Error) => void) | undefined;
  private initializeTask: Promise<void> | undefined;
  private releaseBuildAssetTask: (() => void) | undefined;
  private nextRequestId = 1;
  private disposed = false;
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(buildKey: string) {
    this.buildKey = buildKey;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseBuildAssetTask?.();
    this.releaseBuildAssetTask = undefined;
    this.stopWorker(new DOMException(`Retrace session disposed`, `AbortError`));
  }

  async retrace(text: string, kind: `crash` | `log`) {
    if (this.disposed || !hasRetraceableStack(text)) return text;
    await this.ensureInitialized();
    return this.request<string>({
      type: kind == `crash` ? `retrace-crash` : `retrace-log`,
      text,
    });
  }

  private ensureInitialized() {
    if (!this.initializeTask) {
      const task = this.initialize();
      this.initializeTask = task;
      void task.catch(() => {
        if (this.initializeTask == task) this.initializeTask = undefined;
      });
    }
    return this.initializeTask;
  }

  private async initialize() {
    const lease = acquireBuildAssetZipTask(this.buildKey);
    this.releaseBuildAssetTask = lease.release;
    let asset: BuildAssetZip | undefined;
    try {
      asset = await lease.task;
      if (this.disposed) {
        throw new DOMException(`Retrace session disposed`, `AbortError`);
      }
      await this.register(asset.data.slice(0));
    } catch (error) {
      if (
        asset &&
        !(error instanceof DOMException && error.name == `AbortError`)
      ) {
        await removeBuildAssetCache(asset.assetId);
      }
      this.stopWorker(getError(error));
      throw error;
    } finally {
      if (this.releaseBuildAssetTask == lease.release) {
        this.releaseBuildAssetTask = undefined;
      }
      lease.release();
    }
  }

  private async register(data: ArrayBuffer) {
    await this.request<{ mapId: string }>({ type: `register`, data }, [data]);
  }

  private getWorker() {
    if (this.worker) return this.worker;
    if (this.disposed)
      throw new DOMException(`Retrace session disposed`, `AbortError`);
    const worker = new Worker(new URL(`./retrace.worker.ts`, import.meta.url), {
      type: `module`,
    });
    let resolveWorkerReady: (() => void) | undefined;
    this.workerReadyTask = new Promise<void>((resolve, reject) => {
      resolveWorkerReady = resolve;
      this.rejectWorkerReady = reject;
    });
    worker.onmessage = (event: MessageEvent<RetraceWorkerResponse>) => {
      const response = event.data;
      if (`type` in response) {
        resolveWorkerReady?.();
        resolveWorkerReady = undefined;
        this.rejectWorkerReady = undefined;
        return;
      }
      const pending = this.pendingRequests.get(response.id);
      if (!pending) return;
      this.pendingRequests.delete(response.id);
      if (`error` in response) pending.reject(new Error(response.error));
      else pending.resolve(response.result);
    };
    worker.onerror = (event) => {
      this.stopWorker(new Error(event.message || `Retrace Worker 运行失败`));
    };
    this.worker = worker;
    return worker;
  }

  private request<T>(request: WorkerRequest, transfer: Transferable[] = []) {
    return new Promise<T>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = this.getWorker();
      } catch (error) {
        reject(getError(error));
        return;
      }
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      void this.workerReadyTask!.then(
        () => {
          if (!this.pendingRequests.has(id)) return;
          try {
            worker.postMessage(
              { id, ...request } satisfies RetraceWorkerRequest,
              transfer,
            );
          } catch (error) {
            this.pendingRequests.delete(id);
            reject(getError(error));
          }
        },
        (error) => {
          if (!this.pendingRequests.delete(id)) return;
          reject(getError(error));
        },
      );
    });
  }

  private stopWorker(error: Error) {
    this.worker?.terminate();
    this.worker = undefined;
    this.rejectWorkerReady?.(error);
    this.workerReadyTask = undefined;
    this.rejectWorkerReady = undefined;
    this.initializeTask = undefined;
    for (const pending of this.pendingRequests.values()) pending.reject(error);
    this.pendingRequests.clear();
  }
}
