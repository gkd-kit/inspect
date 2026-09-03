import type { RawSubscription } from '@gkd-kit/api';
import type { JSZipObject } from 'jszip';
import { loadAsync } from '@/shared/lib/chunk';
import { getAppNameMapFromValue } from './app_names';
import {
  createSourceLinkContext,
  isLogVersionPath,
  parseLogBuildKey,
  parseLogVersionInfo,
  type LogVersionInfo,
  type SourceLinkContext,
} from './source_links';
import { getSubscriptionNameEntry } from './subscription_names';
import { assertSafeZipStructure } from './zip_limits';

export const MAX_ZIP_SIZE = 50 * 1024 * 1024;
export const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 2000;
export const MAX_TEXT_SIZE = 20 * 1024 * 1024;
export const MAX_JSON_SIZE = 2 * 1024 * 1024;
export const MAX_DATABASE_SIZE = 100 * 1024 * 1024;
export const MAX_TEXT_LINE_COUNT = 500_000;
export const MAX_ENTRY_PATH_SIZE = 1024;
export const MAX_ENTRY_PATH_DEPTH = 64;
export const MAX_ENTRY_SEGMENT_SIZE = 255;

const textExtensions = new Set([
  `.log`,
  `.txt`,
  `.sql`,
  `.xml`,
  `.md`,
  `.yaml`,
  `.yml`,
  `.csv`,
]);
const databaseExtensions = new Set([`.db`, `.sqlite`, `.sqlite3`]);

type ExtendedZipObject = JSZipObject & {
  unsafeOriginalName?: string;
  _data?: {
    compressedSize?: number;
    uncompressedSize?: number;
  };
};

type ZipStream = {
  on(event: `data`, callback: (chunk: Uint8Array) => void): ZipStream;
  on(event: `end`, callback: () => void): ZipStream;
  on(event: `error`, callback: (error: Error) => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
};

type StreamZipObject = JSZipObject & {
  internalStream(type: `uint8array`): ZipStream;
};

export type LogEntryKind =
  | `text`
  | `json`
  | `database`
  | `database-sidecar`
  | `binary`;

export type LogEntry = {
  path: string;
  name: string;
  extension: string;
  size: number;
  kind: LogEntryKind;
  file: JSZipObject;
  readBudget: {
    total: number;
    sizes: Map<string, number>;
  };
};

export type LogArchive = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  entries: LogEntry[];
  entryMap: Map<string, LogEntry>;
};

const getExtension = (path: string) => {
  const name = path.split(`/`).at(-1) || path;
  const index = name.lastIndexOf(`.`);
  return index >= 0 ? name.slice(index).toLowerCase() : ``;
};

const getEntryKind = (path: string): LogEntryKind => {
  const lower = path.toLowerCase();
  if (lower.endsWith(`-wal`) || lower.endsWith(`-shm`)) {
    return `database-sidecar`;
  }
  const extension = getExtension(path);
  if (extension == `.json`) return `json`;
  if (databaseExtensions.has(extension)) return `database`;
  if (textExtensions.has(extension)) return `text`;
  return `binary`;
};

const getPriority = (entry: LogEntry) => {
  if (entry.extension == `.log`) return 0;
  if (entry.kind == `text`) return 1;
  if (entry.kind == `json`) return 2;
  if (entry.kind == `database`) return 3;
  return 4;
};

export const getDefaultLogEntry = (archive: LogArchive) => {
  return archive.entries
    .filter(
      (entry) =>
        entry.kind == `text` ||
        entry.kind == `json` ||
        entry.kind == `database`,
    )
    .toSorted((a, b) => getPriority(a) - getPriority(b))[0];
};

export const loadLogArchive = async (
  input: Blob | ArrayBuffer | Uint8Array,
  name: string,
): Promise<LogArchive> => {
  const compressedSize = input instanceof Blob ? input.size : input.byteLength;
  if (compressedSize > MAX_ZIP_SIZE) {
    throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`);
  }
  const data =
    input instanceof Blob
      ? new Uint8Array(await input.arrayBuffer())
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  const metadata = assertSafeZipStructure(data, {
    maxEntries: MAX_ENTRY_COUNT,
    maxEntryNameSize: MAX_ENTRY_PATH_SIZE,
    maxUncompressedSize: MAX_UNCOMPRESSED_SIZE,
  });
  const zip = await loadAsync(data);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  if (files.length > MAX_ENTRY_COUNT) {
    throw new Error(`ZIP 内文件数量不能超过 ${MAX_ENTRY_COUNT}`);
  }
  let uncompressedSize = 0;
  const readBudget = { total: 0, sizes: new Map<string, number>() };
  const entries = files.map((rawFile) => {
    const file = rawFile as ExtendedZipObject;
    if (
      file.unsafeOriginalName &&
      file.unsafeOriginalName.replaceAll(`\\`, `/`) != file.name
    ) {
      throw new Error(`ZIP 包含不安全路径: ${file.unsafeOriginalName}`);
    }
    const size = file._data?.uncompressedSize || 0;
    uncompressedSize += size;
    const path = file.name.replaceAll(`\\`, `/`).replace(/^\/+/, ``);
    const pathParts = path.split(`/`);
    if (
      path.length > MAX_ENTRY_PATH_SIZE ||
      pathParts.length > MAX_ENTRY_PATH_DEPTH ||
      pathParts.some((part) => !part || part.length > MAX_ENTRY_SEGMENT_SIZE)
    ) {
      throw new Error(`ZIP 条目路径超出预览限制: ${path}`);
    }
    return {
      path,
      name: path.split(`/`).at(-1) || path,
      extension: getExtension(path),
      size,
      kind: getEntryKind(path),
      file: rawFile,
      readBudget,
    } satisfies LogEntry;
  });
  if (uncompressedSize > MAX_UNCOMPRESSED_SIZE) {
    throw new Error(
      `ZIP 解压后总大小不能超过 ${formatBytes(MAX_UNCOMPRESSED_SIZE)}`,
    );
  }
  if (uncompressedSize != metadata.totalUncompressedSize) {
    throw new Error(`ZIP 中央目录大小信息不一致`);
  }
  const paths = new Set(entries.map((entry) => entry.path));
  for (const entry of entries) {
    const parts = entry.path.split(`/`);
    let parentPath = parts[0];
    for (let index = 1; index < parts.length; index++) {
      if (paths.has(parentPath)) {
        throw new Error(`ZIP 同时包含文件及其子路径: ${parentPath}`);
      }
      parentPath += `/${parts[index]}`;
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, `zh-CN`));
  return {
    name,
    compressedSize,
    uncompressedSize,
    entries,
    entryMap: new Map(entries.map((entry) => [entry.path, entry])),
  };
};

const entryReadTasks = new WeakMap<
  JSZipObject,
  Map<number, Promise<Uint8Array>>
>();
const entryReadErrors = new WeakMap<JSZipObject, Map<number, Error>>();

const readEntryBytesOnce = async (
  entry: LogEntry,
  sizeLimit = MAX_TEXT_SIZE,
) => {
  if (entry.size > sizeLimit) {
    throw new Error(`${entry.name} 超过可预览上限 ${formatBytes(sizeLimit)}`);
  }
  const knownSize = entry.readBudget.sizes.get(entry.path);
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    let settled = false;
    const stream = (entry.file as StreamZipObject).internalStream(`uint8array`);
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    stream
      .on(`data`, (chunk) => {
        if (settled) return;
        if (byteLength + chunk.byteLength > sizeLimit) {
          fail(
            new Error(`${entry.name} 超过可预览上限 ${formatBytes(sizeLimit)}`),
          );
          return;
        }
        if (
          knownSize == null &&
          entry.readBudget.total + chunk.byteLength > MAX_UNCOMPRESSED_SIZE
        ) {
          fail(new Error(`ZIP 实际解压大小超过可预览上限`));
          return;
        }
        byteLength += chunk.byteLength;
        if (knownSize == null) {
          entry.readBudget.total += chunk.byteLength;
        }
        chunks.push(chunk);
      })
      .on(`error`, fail)
      .on(`end`, () => {
        if (settled) return;
        settled = true;
        const result = new Uint8Array(byteLength);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }
        if (knownSize == null) {
          entry.readBudget.sizes.set(entry.path, byteLength);
        }
        resolve(result);
      })
      .resume();
  });
};

export const readEntryBytes = (entry: LogEntry, sizeLimit = MAX_TEXT_SIZE) => {
  const previousError = entryReadErrors.get(entry.file)?.get(sizeLimit);
  if (previousError) return Promise.reject(previousError);
  let tasks = entryReadTasks.get(entry.file);
  if (!tasks) {
    tasks = new Map();
    entryReadTasks.set(entry.file, tasks);
  }
  let task = tasks.get(sizeLimit);
  if (!task) {
    task = readEntryBytesOnce(entry, sizeLimit);
    tasks.set(sizeLimit, task);
    void task.then(
      () => tasks?.delete(sizeLimit),
      (error: unknown) => {
        tasks?.delete(sizeLimit);
        let errors = entryReadErrors.get(entry.file);
        if (!errors) {
          errors = new Map();
          entryReadErrors.set(entry.file, errors);
        }
        errors.set(
          sizeLimit,
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );
  }
  return task;
};

export const getDatabaseFiles = async (
  archive: LogArchive,
  mainEntry: LogEntry,
) => {
  const walEntry = archive.entryMap.get(`${mainEntry.path}-wal`);
  const shmEntry = archive.entryMap.get(`${mainEntry.path}-shm`);
  const totalSize =
    mainEntry.size + (walEntry?.size || 0) + (shmEntry?.size || 0);
  if (totalSize > MAX_DATABASE_SIZE) {
    throw new Error(
      `数据库文件组超过可预览上限 ${formatBytes(MAX_DATABASE_SIZE)}`,
    );
  }
  const database = await readEntryBytes(mainEntry, MAX_DATABASE_SIZE);
  const wal = walEntry
    ? await readEntryBytes(walEntry, MAX_DATABASE_SIZE - database.byteLength)
    : undefined;
  return { database, wal, walEntry, shmEntry };
};

export const decodeLogText = (data: Uint8Array) => {
  const text = new TextDecoder().decode(data);
  let lineCount = 1;
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) == 10) {
      lineCount++;
    } else if (
      text.charCodeAt(index) == 13 &&
      text.charCodeAt(index + 1) != 10
    ) {
      lineCount++;
    }
    if (lineCount > MAX_TEXT_LINE_COUNT) {
      throw new Error(`文本行数不能超过 ${MAX_TEXT_LINE_COUNT}`);
    }
  }
  return text;
};

const archiveSourceLinkContextTasks = new WeakMap<
  LogArchive,
  Promise<SourceLinkContext | undefined>
>();

const getLogVersionEntries = (archive: LogArchive) => {
  return archive.entries.filter((entry) => isLogVersionPath(entry.path));
};

const logVersionInfoTasks = new WeakMap<
  LogArchive,
  Promise<LogVersionInfo | undefined>
>();

export const getLogVersionInfo = (archive: LogArchive) => {
  let task = logVersionInfoTasks.get(archive);
  if (task) return task;
  task = (async () => {
    const items: LogVersionInfo[] = [];
    for (const entry of getLogVersionEntries(archive)) {
      try {
        const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
        const item = parseLogVersionInfo(raw);
        if (item) items.push(item);
      } catch {}
    }
    const first = items[0];
    if (!first) return;
    if (
      items.some(
        (item) =>
          item.versionName != first.versionName ||
          item.versionCode != first.versionCode ||
          item.commitUrl != first.commitUrl,
      )
    ) {
      return;
    }
    return first;
  })();
  logVersionInfoTasks.set(archive, task);
  return task;
};

const logBuildKeyTasks = new WeakMap<LogArchive, Promise<string | undefined>>();

export const getLogBuildKey = (archive: LogArchive) => {
  let task = logBuildKeyTasks.get(archive);
  if (task) return task;
  task = (async () => {
    const entry = archive.entries.find(
      (item) => item.path.toLowerCase() == `gkd.json`,
    );
    if (!entry) return;
    try {
      const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
      return parseLogBuildKey(raw);
    } catch {}
  })();
  logBuildKeyTasks.set(archive, task);
  return task;
};

export const getArchiveSourceLinkContext = (archive: LogArchive) => {
  let task = archiveSourceLinkContextTasks.get(archive);
  if (task) return task;
  task = (async () => {
    const sourcePathsEntry = archive.entries.find(
      (entry) => entry.path.toLowerCase() == `source-paths.txt`,
    );
    if (!sourcePathsEntry) return;
    const versionEntries = getLogVersionEntries(archive);
    if (versionEntries.length == 0) return;
    try {
      const sourcePathsRaw = decodeLogText(
        await readEntryBytes(sourcePathsEntry, MAX_JSON_SIZE),
      );
      const contexts: SourceLinkContext[] = [];
      for (const entry of versionEntries) {
        try {
          const versionRaw = decodeLogText(
            await readEntryBytes(entry, MAX_JSON_SIZE),
          );
          const context = createSourceLinkContext(versionRaw, sourcePathsRaw);
          if (context) contexts.push(context);
        } catch {}
      }
      const first = contexts[0];
      if (!first) return;
      if (
        contexts.some(
          (context) =>
            context.repositoryUrl != first.repositoryUrl ||
            context.commitId.toLowerCase() != first.commitId.toLowerCase(),
        )
      ) {
        return;
      }
      return first;
    } catch {}
  })();
  archiveSourceLinkContextTasks.set(archive, task);
  return task;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

const MAX_STRUCTURED_ITEMS = 10_000;

const appNameMapTasks = new WeakMap<
  LogArchive,
  Promise<Record<string, string>>
>();

export const getLogAppNames = (archive: LogArchive) => {
  let task = appNameMapTasks.get(archive);
  if (task) return task;
  task = (async () => {
    const entry = archive.entries.find((item) => {
      const path = item.path.toLowerCase();
      return path == `apps.json` || path.endsWith(`/apps.json`);
    });
    if (!entry) return {};
    try {
      const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
      return getAppNameMapFromValue(JSON.parse(raw));
    } catch {
      return {};
    }
  })();
  appNameMapTasks.set(archive, task);
  return task;
};

const subscriptionNameMapTasks = new WeakMap<
  LogArchive,
  Promise<Record<string, string>>
>();

export const getLogSubscriptionNames = (archive: LogArchive) => {
  let task = subscriptionNameMapTasks.get(archive);
  if (task) return task;
  task = (async () => {
    const entries = archive.entries.filter((entry) =>
      /^subscription\/[^/]+\.json$/i.test(entry.path),
    );
    const nameEntries: Array<readonly [string, string]> = [];
    for (const entry of entries) {
      try {
        const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
        const nameEntry = getSubscriptionNameEntry(JSON.parse(raw));
        if (nameEntry) nameEntries.push(nameEntry);
      } catch {}
    }
    return Object.fromEntries(nameEntries.filter((entry) => entry != null));
  })();
  subscriptionNameMapTasks.set(archive, task);
  return task;
};

export const isRawSubscription = (value: unknown): value is RawSubscription => {
  if (!isObject(value)) return false;
  if (
    typeof value.id != `number` ||
    !Number.isSafeInteger(value.id) ||
    typeof value.name != `string` ||
    typeof value.version != `number` ||
    !Number.isSafeInteger(value.version)
  ) {
    return false;
  }
  if (
    ![`apps`, `globalGroups`, `categories`].every(
      (key) => value[key] == null || Array.isArray(value[key]),
    )
  ) {
    return false;
  }
  const apps: unknown[] = Array.isArray(value.apps) ? value.apps : [];
  const globalGroups: unknown[] = Array.isArray(value.globalGroups)
    ? value.globalGroups
    : [];
  const categories: unknown[] = Array.isArray(value.categories)
    ? value.categories
    : [];
  if (
    apps.length > MAX_STRUCTURED_ITEMS ||
    globalGroups.length > MAX_STRUCTURED_ITEMS ||
    categories.length > MAX_STRUCTURED_ITEMS ||
    !categories.every(isObject)
  ) {
    return false;
  }
  let itemCount = apps.length + globalGroups.length + categories.length;
  const addGroupRules = (group: Record<string, unknown>) => {
    const rules = group.rules;
    itemCount += Array.isArray(rules) ? rules.length : rules == null ? 0 : 1;
    return itemCount <= MAX_STRUCTURED_ITEMS;
  };
  for (const app of apps) {
    if (
      !isObject(app) ||
      typeof app.id != `string` ||
      !Array.isArray(app.groups)
    ) {
      return false;
    }
    itemCount += app.groups.length;
    if (itemCount > MAX_STRUCTURED_ITEMS) return false;
    for (const group of app.groups) {
      if (!isObject(group) || !addGroupRules(group)) return false;
    }
  }
  for (const group of globalGroups) {
    if (!isObject(group) || !addGroupRules(group)) return false;
  }
  return true;
};

export const shouldUseSubscriptionPreview = (
  entry: LogEntry,
  value: unknown,
) => {
  return (
    isRawSubscription(value) &&
    (entry.path.toLowerCase().startsWith(`subscription/`) ||
      [`apps`, `globalGroups`, `categories`].some((key) => key in value))
  );
};

export const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return `0 B`;
  const units = [`B`, `KiB`, `MiB`, `GiB`];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  const fractionDigits = index == 0 || size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(fractionDigits)} ${units[index]}`;
};
