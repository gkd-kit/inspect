import pLimit from 'p-limit';

export const CRASH_TREE_KEY = `__crash_preview__`;
export const CRASH_READ_CONCURRENCY = 4;

export type CrashEntryLike = {
  path: string;
};

export type CrashPreviewStatus =
  | `valid`
  | `incomplete`
  | `invalid`
  | `unsupported`;

export type CrashSummary = {
  path: string;
  fileName: string;
  status: CrashPreviewStatus;
  error?: string;
  id?: number;
  mtime?: number;
  timestamp?: number;
  device?: string;
  androidVersionCode?: number;
  androidVersionName?: string;
  versionCode?: number;
  versionName?: string;
  name?: string;
  message?: string;
  thread?: string;
};

export type CrashDetail = CrashSummary & {
  parsed: boolean;
  raw: string;
  value?: unknown;
  stackTrace?: string;
};

type NormalizedCrash = {
  summary: CrashSummary;
  stackTrace?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

const getOptionalString = (value: unknown) => {
  return typeof value == `string` && value.trim() ? value : undefined;
};

const getOptionalNumber = (value: unknown) => {
  return typeof value == `number` && Number.isFinite(value) ? value : undefined;
};

const toTimestamp = (value: number | undefined) => {
  if (value == null) return;
  const timestamp = Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  return Number.isNaN(new Date(timestamp).getTime()) ? undefined : timestamp;
};

const getFileTimestamp = (path: string) => {
  const name = path.split(`/`).at(-1) || path;
  const match = name.match(
    /gkd_crash-(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i,
  );
  if (!match) return;
  const values = match.slice(1).map(Number);
  const [year, month, day, hour, minute, second] = values;
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() != year ||
    date.getMonth() != month - 1 ||
    date.getDate() != day ||
    date.getHours() != hour ||
    date.getMinutes() != minute ||
    date.getSeconds() != second
  ) {
    return;
  }
  return date.getTime();
};

const getBaseSummary = (path: string): CrashSummary => ({
  path,
  fileName: path.split(`/`).at(-1) || path,
  status: `incomplete`,
  timestamp: getFileTimestamp(path),
});

const normalizeCrashValue = (value: unknown, path: string): NormalizedCrash => {
  const summary = getBaseSummary(path);
  if (!isObject(value)) return { summary };

  summary.id = getOptionalNumber(value.id);
  summary.mtime = getOptionalNumber(value.mtime);
  summary.timestamp =
    toTimestamp(summary.mtime) || toTimestamp(summary.id) || summary.timestamp;
  summary.device = getOptionalString(value.device);
  summary.androidVersionCode = getOptionalNumber(value.androidVersionCode);
  summary.androidVersionName = getOptionalString(value.androidVersionName);
  summary.versionCode = getOptionalNumber(value.versionCode);
  summary.versionName = getOptionalString(value.versionName);
  summary.name = getOptionalString(value.name);
  summary.message = getOptionalString(value.message);
  summary.thread = getOptionalString(value.thread);
  const stackTrace = getOptionalString(value.stackTrace);
  summary.status = summary.name && stackTrace ? `valid` : `incomplete`;
  return { summary, stackTrace };
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const isCrashPath = (path: string) => {
  return /^crash\/.+/i.test(path.replaceAll(`\\`, `/`));
};

export const isCrashJsonPath = (path: string) => {
  return isCrashPath(path) && path.toLowerCase().endsWith(`.json`);
};

export const getCrashEntries = <T extends CrashEntryLike>(
  entries: readonly T[],
) => {
  return entries.filter((entry) => isCrashPath(entry.path));
};

export const parseCrashSummary = (raw: string, path: string): CrashSummary => {
  try {
    return normalizeCrashValue(JSON.parse(raw), path).summary;
  } catch (error) {
    return {
      ...getBaseSummary(path),
      status: `invalid`,
      error: getErrorMessage(error),
    };
  }
};

export const parseCrashDetail = (raw: string, path: string): CrashDetail => {
  try {
    const value: unknown = JSON.parse(raw);
    const { summary, stackTrace } = normalizeCrashValue(value, path);
    return { ...summary, parsed: true, raw, value, stackTrace };
  } catch (error) {
    return {
      ...getBaseSummary(path),
      status: `invalid`,
      error: getErrorMessage(error),
      parsed: false,
      raw,
    };
  }
};

export const getUnreadableCrashSummary = (
  path: string,
  error: unknown,
): CrashSummary => ({
  ...getBaseSummary(path),
  status: `invalid`,
  error: getErrorMessage(error),
});

export const getUnreadableCrashDetail = (
  path: string,
  error: unknown,
): CrashDetail => ({
  ...getUnreadableCrashSummary(path, error),
  parsed: false,
  raw: ``,
});

export const getUnsupportedCrashSummary = (path: string): CrashSummary => ({
  ...getBaseSummary(path),
  status: `unsupported`,
  error: `仅支持 JSON 崩溃记录`,
});

export const getUnsupportedCrashDetail = (path: string): CrashDetail => ({
  ...getUnsupportedCrashSummary(path),
  parsed: false,
  raw: ``,
});

export const sortCrashSummaries = (items: readonly CrashSummary[]) => {
  return items.toSorted((a, b) => {
    const timeDifference = (b.timestamp || 0) - (a.timestamp || 0);
    if (timeDifference) return timeDifference;
    return b.path.localeCompare(a.path, `zh-CN`);
  });
};

export const loadCrashSummaries = async <T extends CrashEntryLike>(
  entries: readonly T[],
  readText: (entry: T) => Promise<string>,
) => {
  const limit = pLimit(CRASH_READ_CONCURRENCY);
  const items = await Promise.all(
    getCrashEntries(entries).map((entry) =>
      limit(async () => {
        if (!isCrashJsonPath(entry.path)) {
          return getUnsupportedCrashSummary(entry.path);
        }
        try {
          return parseCrashSummary(await readText(entry), entry.path);
        } catch (error) {
          return getUnreadableCrashSummary(entry.path, error);
        }
      }),
    ),
  );
  return sortCrashSummaries(items);
};

const pad = (value: number, length = 2) => {
  return value.toString().padStart(length, `0`);
};

export const formatCrashTimestamp = (timestamp: number | undefined) => {
  if (timestamp == null) return `-`;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return `-`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  );
};
