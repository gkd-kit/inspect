import pLimit from 'p-limit';

export const LOG_TREE_KEY = `__log_directory_preview__`;
export const SUBSCRIPTION_TREE_KEY = `__subscription_directory_preview__`;
export const DIRECTORY_READ_CONCURRENCY = 4;

export type DirectoryEntryLike = {
  path: string;
  size?: number;
};

export type DirectoryPreviewStatus =
  | `valid`
  | `incomplete`
  | `invalid`
  | `unsupported`;

export type LogFileSummary = {
  path: string;
  fileName: string;
  size: number;
  timestamp?: number;
};

export type SubscriptionFileSummary = {
  path: string;
  fileName: string;
  status: DirectoryPreviewStatus;
  error?: string;
  id?: number;
  name?: string;
  version?: number;
  author?: string;
  appsCount?: number;
  globalGroupsCount?: number;
  categoriesCount?: number;
};

export type SubscriptionFileDetail = SubscriptionFileSummary & {
  parsed: boolean;
  raw: string;
  value?: unknown;
};

const normalizePath = (path: string) => path.replaceAll(`\\`, `/`);

const isDirectoryPath = (path: string, directory: string) => {
  return normalizePath(path).toLowerCase().startsWith(`${directory}/`);
};

export const isLogDirectoryPath = (path: string) => {
  return isDirectoryPath(path, `log`);
};

export const isSubscriptionDirectoryPath = (path: string) => {
  return isDirectoryPath(path, `subscription`);
};

export const getLogDirectoryEntries = <T extends DirectoryEntryLike>(
  entries: readonly T[],
) => entries.filter((entry) => isLogDirectoryPath(entry.path));

export const getSubscriptionDirectoryEntries = <T extends DirectoryEntryLike>(
  entries: readonly T[],
) => entries.filter((entry) => isSubscriptionDirectoryPath(entry.path));

const getFileName = (path: string) => path.split(`/`).at(-1) || path;

const getLogFileTimestamp = (path: string) => {
  const match = getFileName(path).match(/gkd-(\d{4})(\d{2})(\d{2})\.log$/i);
  if (!match) return;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() != year ||
    date.getMonth() != month - 1 ||
    date.getDate() != day
  ) {
    return;
  }
  return date.getTime();
};

export const getLogFileSummaries = <T extends DirectoryEntryLike>(
  entries: readonly T[],
) => {
  return getLogDirectoryEntries(entries)
    .map(
      (entry): LogFileSummary => ({
        path: entry.path,
        fileName: getFileName(entry.path),
        size: entry.size || 0,
        timestamp: getLogFileTimestamp(entry.path),
      }),
    )
    .toSorted((a, b) => {
      const difference = (b.timestamp || 0) - (a.timestamp || 0);
      return difference || b.path.localeCompare(a.path, `zh-CN`);
    });
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

const getOptionalString = (value: unknown) => {
  return typeof value == `string` && value.trim() ? value : undefined;
};

const getOptionalInteger = (value: unknown) => {
  return typeof value == `number` && Number.isSafeInteger(value)
    ? value
    : undefined;
};

const getArrayLength = (value: unknown) => {
  return Array.isArray(value) ? value.length : undefined;
};

const getFileSubscriptionId = (path: string) => {
  const value = Number(getFileName(path).replace(/\.json$/i, ``));
  return Number.isSafeInteger(value) ? value : undefined;
};

const getBaseSubscriptionSummary = (path: string): SubscriptionFileSummary => ({
  path,
  fileName: getFileName(path),
  status: `incomplete`,
  id: getFileSubscriptionId(path),
});

const normalizeSubscriptionValue = (
  value: unknown,
  path: string,
): SubscriptionFileSummary => {
  const summary = getBaseSubscriptionSummary(path);
  if (!isObject(value)) return summary;
  summary.id = getOptionalInteger(value.id) ?? summary.id;
  summary.name = getOptionalString(value.name);
  summary.version = getOptionalInteger(value.version);
  summary.author = getOptionalString(value.author);
  summary.appsCount = getArrayLength(value.apps);
  summary.globalGroupsCount = getArrayLength(value.globalGroups);
  summary.categoriesCount = getArrayLength(value.categories);
  summary.status =
    summary.id != null && summary.name && summary.version != null
      ? `valid`
      : `incomplete`;
  return summary;
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const isSubscriptionJsonPath = (path: string) => {
  return (
    isSubscriptionDirectoryPath(path) && path.toLowerCase().endsWith(`.json`)
  );
};

export const parseSubscriptionFileSummary = (
  raw: string,
  path: string,
): SubscriptionFileSummary => {
  try {
    return normalizeSubscriptionValue(JSON.parse(raw), path);
  } catch (error) {
    return {
      ...getBaseSubscriptionSummary(path),
      status: `invalid`,
      error: getErrorMessage(error),
    };
  }
};

export const parseSubscriptionFileDetail = (
  raw: string,
  path: string,
): SubscriptionFileDetail => {
  try {
    const value: unknown = JSON.parse(raw);
    return {
      ...normalizeSubscriptionValue(value, path),
      parsed: true,
      raw,
      value,
    };
  } catch (error) {
    return {
      ...getBaseSubscriptionSummary(path),
      status: `invalid`,
      error: getErrorMessage(error),
      parsed: false,
      raw,
    };
  }
};

const getUnreadableSubscriptionSummary = (
  path: string,
  error: unknown,
): SubscriptionFileSummary => ({
  ...getBaseSubscriptionSummary(path),
  status: `invalid`,
  error: getErrorMessage(error),
});

export const getUnreadableSubscriptionDetail = (
  path: string,
  error: unknown,
): SubscriptionFileDetail => ({
  ...getUnreadableSubscriptionSummary(path, error),
  parsed: false,
  raw: ``,
});

const getUnsupportedSubscriptionSummary = (
  path: string,
): SubscriptionFileSummary => ({
  ...getBaseSubscriptionSummary(path),
  status: `unsupported`,
  error: `仅支持 JSON 订阅文件`,
});

export const getUnsupportedSubscriptionDetail = (
  path: string,
): SubscriptionFileDetail => ({
  ...getUnsupportedSubscriptionSummary(path),
  parsed: false,
  raw: ``,
});

const sortSubscriptionSummaries = (
  items: readonly SubscriptionFileSummary[],
) => {
  return items.toSorted((a, b) => {
    if (a.id != null && b.id != null && a.id != b.id) return a.id - b.id;
    if (a.id != null && b.id == null) return -1;
    if (a.id == null && b.id != null) return 1;
    return a.path.localeCompare(b.path, `zh-CN`);
  });
};

export const loadSubscriptionFileSummaries = async <
  T extends DirectoryEntryLike,
>(
  entries: readonly T[],
  readText: (entry: T) => Promise<string>,
) => {
  const limit = pLimit(DIRECTORY_READ_CONCURRENCY);
  const items = await Promise.all(
    getSubscriptionDirectoryEntries(entries).map((entry) =>
      limit(async () => {
        if (!isSubscriptionJsonPath(entry.path)) {
          return getUnsupportedSubscriptionSummary(entry.path);
        }
        try {
          return parseSubscriptionFileSummary(
            await readText(entry),
            entry.path,
          );
        } catch (error) {
          return getUnreadableSubscriptionSummary(entry.path, error);
        }
      }),
    ),
  );
  return sortSubscriptionSummaries(items);
};

const pad = (value: number) => value.toString().padStart(2, `0`);

export const formatLogFileDate = (timestamp: number | undefined) => {
  if (timestamp == null) return `-`;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return `-`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
