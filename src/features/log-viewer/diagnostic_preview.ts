export const STARTUP_TREE_KEY = `__startup_directory_preview__`;
export const isStartupPath = (path: string) => /^startup-log\/.+/i.test(path);
export type DiagnosticKind = `permission` | `storage` | `startup`;
export type DiagnosticRow = { label: string; value: string };
export const getDiagnosticKind = (path: string): DiagnosticKind | undefined => {
  const lower = path.toLowerCase();
  if (lower == `metadata/permission.json`) return `permission`;
  if (lower == `metadata/storage.json`) return `storage`;
  if (isStartupPath(path) && lower.endsWith(`.json`)) return `startup`;
};
export const asRecord = (value: unknown): Record<string, unknown> =>
  value != null && typeof value == `object` && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const displayDiagnosticValue = (value: unknown): string => {
  if (value == null) return `未知`;
  if (value === true) return `是`;
  if (value === false) return `否`;
  return typeof value == `object` ? JSON.stringify(value) : String(value);
};
export const formatDiagnosticTime = (value: unknown, timeZone: unknown) => {
  if (typeof value != `number` || !Number.isFinite(value)) return `未知`;
  try {
    return new Intl.DateTimeFormat(`zh-CN`, {
      timeZone: typeof timeZone == `string` ? timeZone : `UTC`,
      year: `numeric`,
      month: `2-digit`,
      day: `2-digit`,
      hour: `2-digit`,
      minute: `2-digit`,
      second: `2-digit`,
      hourCycle: `h23`,
    }).format(value);
  } catch {
    return `未知`;
  }
};
export const getDiagnosticRows = (
  kind: DiagnosticKind,
  value: unknown,
): DiagnosticRow[] => {
  const data = asRecord(value);
  const rows: DiagnosticRow[] = [];
  const add = (label: string, value: unknown) =>
    rows.push({ label, value: displayDiagnosticValue(value) });
  add(`采集时间`, formatDiagnosticTime(data.capturedAt, data.timeZone));
  add(`时区`, data.timeZone ?? `UTC`);
  if (kind == `permission`) {
    add(`权限检查来源`, data.source);
    add(`应用列表来源`, asRecord(data.appList).source);
    add(`应用列表查询异常`, asRecord(data.appList).queryAbnormal);
    return rows;
  }
  add(`启动时间`, formatDiagnosticTime(data.startedAt, data.timeZone));
  if (kind == `startup`) {
    const app = asRecord(data.app);
    const device = asRecord(data.device);
    add(`进程`, data.processName);
    add(`PID`, data.pid);
    add(`UID`, data.uid);
    add(`包名`, data.packageName);
    add(`应用版本`, app.versionName);
    add(`版本代码`, app.versionCode);
    add(`提交`, app.commitId);
    add(`厂商`, device.manufacturer);
    add(`设备型号`, device.model);
    add(`Android`, device.release);
    add(`SDK`, device.sdk);
    add(`用户已解锁`, asRecord(data.systemStorage).userUnlocked);
    add(`启动后标记`, data.markerAfter);
  } else {
    add(`当前使用目录`, data.activeDirectory);
    add(`当前标记`, data.markerNow);
  }
  const selection = asRecord(
    kind == `startup` ? data.selection : data.selectionAtStartup,
  );
  add(`启动时选择目录`, selection.selectedPath);
  add(`启动时存储位置`, selection.storageLocation);
  add(`启动时选择原因`, selection.reason);
  add(`选择前标记`, selection.markerBefore);
  add(`选择时查询外部存储`, selection.externalQueriedForSelection);
  add(`选择时外部目录`, selection.externalResult);
  add(`尝试创建标记`, selection.markerCreationAttempted);
  add(`标记创建结果`, selection.markerCreated);
  add(`内部目录`, data.internal);
  const external = asRecord(
    kind == `startup` ? data.external : data.externalDiagnosticOnly,
  );
  add(`诊断时外部目录`, external.path);
  add(`诊断时外部状态`, external.state);
  return rows;
};
export const getPermissionRows = (value: unknown) => {
  const data = asRecord(value);
  return Array.isArray(data.permissions)
    ? data.permissions.map((item) => {
        const permission = asRecord(item);
        const status = permission.status;
        return {
          id: displayDiagnosticValue(permission.id),
          name: displayDiagnosticValue(permission.name ?? permission.id),
          status:
            status == `granted`
              ? `已授权`
              : status == `denied`
                ? `未授权`
                : displayDiagnosticValue(status),
          checkedAt: formatDiagnosticTime(permission.checkedAt, data.timeZone),
        };
      })
    : [];
};

export type StartupSummary = {
  path: string;
  timestamp: number;
  time: string;
  process: string;
  version: string;
  device: string;
  storage: string;
  error?: string;
};
export const parseStartupSummary = (
  path: string,
  raw: string,
): StartupSummary => {
  const summary: StartupSummary = {
    path,
    timestamp: 0,
    time: `未知`,
    process: `未知`,
    version: `未知`,
    device: `未知`,
    storage: `未知`,
  };
  try {
    const value: unknown = JSON.parse(raw);
    const data = asRecord(value);
    if (!Object.keys(data).length) throw new Error(`启动记录缺少对象字段`);
    summary.timestamp =
      typeof data.startedAt == `number` && Number.isFinite(data.startedAt)
        ? data.startedAt
        : 0;
    summary.time = formatDiagnosticTime(data.startedAt, data.timeZone);
    summary.process = displayDiagnosticValue(data.processName);
    summary.version = displayDiagnosticValue(asRecord(data.app).versionName);
    summary.device = displayDiagnosticValue(asRecord(data.device).model);
    summary.storage = displayDiagnosticValue(
      asRecord(data.selection).storageLocation,
    );
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
  }
  return summary;
};
