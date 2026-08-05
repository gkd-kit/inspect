const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value == `object` && value != null && !Array.isArray(value);
};

export const MAX_APPS_PREVIEW_ITEMS = 10_000;

const getUserId = (value: unknown) => {
  return typeof value == `number` && Number.isSafeInteger(value)
    ? value
    : undefined;
};

export type DeviceApp = {
  id: string;
  name: string;
  userId: number;
  versionCode?: number;
  versionName?: string;
  isSystem?: boolean;
  hidden?: boolean;
  enabled?: boolean;
};

export type DeviceUserApps = {
  id: number;
  name: string;
  isCurrent: boolean;
  apps: DeviceApp[];
};

export type AppsPreviewData = {
  users: DeviceUserApps[];
  totalApps: number;
};

const getOptionalNumber = (value: unknown) => {
  return typeof value == `number` && Number.isFinite(value) ? value : undefined;
};

const getOptionalString = (value: unknown) => {
  return typeof value == `string` ? value : undefined;
};

const getOptionalBoolean = (value: unknown) => {
  return typeof value == `boolean` ? value : undefined;
};

export const getAppsPreviewData = (
  value: unknown,
): AppsPreviewData | undefined => {
  if (!isObject(value) || !Array.isArray(value.apps)) return;
  if (
    value.apps.length > MAX_APPS_PREVIEW_ITEMS ||
    (Array.isArray(value.otherUsers) &&
      value.otherUsers.length > MAX_APPS_PREVIEW_ITEMS)
  ) {
    return;
  }

  const currentUserId = getUserId(value.userId) ?? 0;
  const users = new Map<number, DeviceUserApps>();
  const addUser = (id: number, name: string, isCurrent = false) => {
    const existing = users.get(id);
    if (existing) {
      existing.isCurrent ||= isCurrent;
      return existing;
    }
    const user: DeviceUserApps = { id, name, isCurrent, apps: [] };
    users.set(id, user);
    return user;
  };

  addUser(currentUserId, `当前用户`, true);
  if (Array.isArray(value.otherUsers)) {
    value.otherUsers.forEach((item) => {
      if (!isObject(item)) return;
      const id = getUserId(item.id);
      if (id == null) return;
      const name =
        typeof item.name == `string` && item.name.trim()
          ? item.name
          : `用户 ${id}`;
      addUser(id, name, id == currentUserId);
    });
  }

  let totalApps = 0;
  value.apps.forEach((item) => {
    if (!isObject(item)) return;
    if (typeof item.id != `string` || typeof item.name != `string`) return;
    const userId = getUserId(item.userId) ?? currentUserId;
    const user = addUser(
      userId,
      userId == currentUserId ? `当前用户` : `用户 ${userId}`,
      userId == currentUserId,
    );
    const app: DeviceApp = {
      id: item.id,
      name: item.name,
      userId,
    };
    const versionCode = getOptionalNumber(item.versionCode);
    const versionName = getOptionalString(item.versionName);
    const isSystem = getOptionalBoolean(item.isSystem);
    const hidden = getOptionalBoolean(item.hidden);
    const enabled = getOptionalBoolean(item.enabled);
    if (versionCode != null) app.versionCode = versionCode;
    if (versionName != null) app.versionName = versionName;
    if (isSystem != null) app.isSystem = isSystem;
    if (hidden != null) app.hidden = hidden;
    if (enabled != null) app.enabled = enabled;
    user.apps.push(app);
    totalApps++;
  });

  return {
    users: [...users.values()].sort((a, b) => {
      if (a.isCurrent != b.isCurrent) return a.isCurrent ? -1 : 1;
      return a.id - b.id;
    }),
    totalApps,
  };
};
