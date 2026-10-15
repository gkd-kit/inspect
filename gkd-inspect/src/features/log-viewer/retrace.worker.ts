import { loadAsync } from 'jszip';
import {
  createRetracer,
  defaultRegex,
  disposeRetracer,
  retraceWith,
} from 'retrace-wasm';
import { retraceCrashText, retraceLogText } from './retrace_text';
import { assertSafeZipStructure } from './zip_limits';

const MAX_BUILD_ASSET_ENTRY_COUNT = 100;
const MAX_BUILD_ASSET_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
const MAX_BUILD_ASSET_PATH_SIZE = 1024;

export type RetraceWorkerRequest =
  | { id: number; type: `register`; data: ArrayBuffer }
  | { id: number; type: `retrace-crash`; text: string }
  | { id: number; type: `retrace-log`; text: string };

export type RetraceWorkerResponse =
  | { type: `ready` }
  | { id: number; result: { mapId: string } | string }
  | { id: number; error: string };

let activeRetracerId: number | undefined;
let activeMapId = ``;

const disposeActiveRetracer = () => {
  if (activeRetracerId == null) return;
  disposeRetracer(activeRetracerId);
  activeRetracerId = undefined;
  activeMapId = ``;
};

const registerMapping = async (data: ArrayBuffer) => {
  const bytes = new Uint8Array(data);
  assertSafeZipStructure(bytes, {
    maxEntries: MAX_BUILD_ASSET_ENTRY_COUNT,
    maxEntryNameSize: MAX_BUILD_ASSET_PATH_SIZE,
    maxUncompressedSize: MAX_BUILD_ASSET_UNCOMPRESSED_SIZE,
  });
  const zip = await loadAsync(bytes);
  const mappingFiles = Object.values(zip.files).filter((file) => {
    if (file.dir) return false;
    const path = file.name.replaceAll(`\\`, `/`);
    return path.split(`/`).at(-1)?.toLowerCase() == `mapping.txt`;
  });
  if (mappingFiles.length != 1) {
    throw new Error(`构建附件必须包含唯一的 mapping.txt`);
  }
  const mapping = await mappingFiles[0]!.async(`string`);
  const mapId = mapping
    .match(/^#[\t ]*pg_map_id:[\t ]*([a-f\d]{64})[\t ]*$/im)?.[1]
    ?.toLowerCase();
  if (!mapId) throw new Error(`mapping.txt 缺少有效的 pg_map_id`);
  disposeActiveRetracer();
  activeRetracerId = createRetracer(mapping, defaultRegex(), false);
  activeMapId = mapId;
  return { mapId };
};

const retraceText = (text: string, kind: `crash` | `log`) => {
  if (activeRetracerId == null || !activeMapId) {
    throw new Error(`mapping.txt 尚未注册`);
  }
  const retrace = (stackTrace: string) =>
    retraceWith(activeRetracerId!, stackTrace);
  return kind == `crash`
    ? retraceCrashText(text, activeMapId, retrace)
    : retraceLogText(text, activeMapId, retrace);
};

self.onmessage = async (event: MessageEvent<RetraceWorkerRequest>) => {
  const request = event.data;
  try {
    const result =
      request.type == `register`
        ? await registerMapping(request.data)
        : retraceText(
            request.text,
            request.type == `retrace-crash` ? `crash` : `log`,
          );
    self.postMessage({
      id: request.id,
      result,
    } satisfies RetraceWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies RetraceWorkerResponse);
  }
};

self.postMessage({ type: `ready` } satisfies RetraceWorkerResponse);
