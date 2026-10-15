import {
  getSelectorPresetIdentity,
  parseSelectorLibraryPayload,
  type SelectorPreset,
  type SelectorPresetInput,
} from './library.ts';
import { isJsonEqual } from '../../shared/lib/equal.ts';

export interface SelectorSourceEntry {
  remoteId: string;
  localId: string;
}
export interface SelectorSource {
  id: string;
  name: string;
  url: string;
  checkedAt: number;
  entries: SelectorSourceEntry[];
}
export interface SelectorLibraryState {
  items: SelectorPreset[];
  sources: SelectorSource[];
}
export type ImportStatus = 'added' | 'updated' | 'unchanged';
export interface SelectorImportRow {
  key: string;
  status: ImportStatus;
  local?: SelectorPreset;
  remote?: SelectorPreset;
  localId: string;
}
export interface SelectorImportPlan {
  rows: SelectorImportRow[];
  incoming: SelectorPreset[];
  source?: SelectorSource;
  fingerprint: string;
  checkedAt: number;
}

export const selectorContent = (
  item: SelectorPresetInput,
): SelectorPresetInput => ({
  name: item.name,
  selector: item.selector,
  description: item.description || '',
  tags: [...(item.tags || [])],
  scope: item.scope,
  ...(item.scope != 'global' ? { appId: item.appId } : {}),
  ...(item.scope == 'activity' ? { activityId: item.activityId } : {}),
});
const sameContent = (a: SelectorPresetInput, b: SelectorPresetInput) =>
  isJsonEqual(selectorContent(a), selectorContent(b));

export const getSelectorSource = (
  sources: readonly SelectorSource[],
  localId: string,
) =>
  sources.find((source) =>
    source.entries.some((entry) => entry.localId == localId),
  );

const parseIncoming = (value: unknown) => {
  const incoming = parseSelectorLibraryPayload(value);
  if (new Set(incoming.map((item) => item.id)).size != incoming.length)
    throw new Error('导入内容包含重复的条目 ID');
  return incoming;
};

const replacePresetContent = (
  remote: SelectorPreset,
  localId: string,
  local: SelectorPreset | undefined,
  now: number,
): SelectorPreset => ({
  ...selectorContent(remote),
  description: remote.description,
  id: localId,
  tags: [...remote.tags],
  createdAt: local?.createdAt || now,
  updatedAt:
    local && sameContent(local, remote)
      ? local.updatedAt
      : Math.max(now, (local?.updatedAt || 0) + 1),
  useCount: local?.useCount || 0,
  ...(local?.lastUsedAt ? { lastUsedAt: local.lastUsedAt } : {}),
  ...(local?.pinned ? { pinned: true } : {}),
  ...(local?.pinnedAt ? { pinnedAt: local.pinnedAt } : {}),
});

export const removeSelectorSource = (
  state: SelectorLibraryState,
  id: string,
): SelectorLibraryState => {
  const source = state.sources.find((item) => item.id == id);
  if (!source) return state;
  const ownedIds = new Set(source.entries.map((entry) => entry.localId));
  return {
    items: state.items.filter((item) => !ownedIds.has(item.id)),
    sources: state.sources.filter((item) => item.id != id),
  };
};

export const replaceSourceItems = (
  state: SelectorLibraryState,
  expectedSource: SelectorSource,
  value: unknown,
  now = Date.now(),
): SelectorLibraryState => {
  const source = state.sources.find((item) => item.id == expectedSource.id);
  if (!source || !isJsonEqual(source, expectedSource))
    throw new Error('来源已改变，请重新检查更新');
  const incoming = parseIncoming(value);
  const byId = new Map(state.items.map((item) => [item.id, item]));
  const previous = source.entries.map((entry) => {
    const local = byId.get(entry.localId);
    return local
      ? { id: entry.remoteId, ...selectorContent(local) }
      : undefined;
  });
  if (
    isJsonEqual(
      previous,
      incoming.map((item) => ({ id: item.id, ...selectorContent(item) })),
    )
  )
    return state;
  const entryById = new Map(
    source.entries.map((entry) => [entry.remoteId, entry]),
  );
  const entries = incoming.map((item) => ({
    remoteId: item.id,
    localId: entryById.get(item.id)?.localId || crypto.randomUUID(),
  }));
  const ownedIds = new Set(source.entries.map((entry) => entry.localId));
  const items = state.items.filter((item) => !ownedIds.has(item.id));
  items.push(
    ...incoming.map((item, index) =>
      replacePresetContent(
        item,
        entries[index].localId,
        byId.get(entries[index].localId),
        now,
      ),
    ),
  );
  return {
    items,
    sources: state.sources.map((item) =>
      item.id == source.id ? { ...source, entries, checkedAt: now } : item,
    ),
  };
};

// Usage and pinning may change while a preview is open without invalidating it.
export const libraryFingerprint = (state: SelectorLibraryState) =>
  JSON.stringify({
    items: state.items.map((item) => ({
      id: item.id,
      content: selectorContent(item),
      updatedAt: item.updatedAt,
    })),
    sources: state.sources,
  });

export const normalizeSourceUrl = (value: string) => {
  const url = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('请输入不含账号密码的 HTTP 或 HTTPS 链接');
  }
  url.hash = '';
  return url.href;
};

export const createImportPlan = (
  state: SelectorLibraryState,
  value: unknown,
  source?: SelectorSource,
  now = Date.now(),
): SelectorImportPlan => {
  if (
    source &&
    state.sources.some((item) => item.id != source.id && item.url == source.url)
  )
    throw new Error('该来源地址已存在');
  const incoming = parseIncoming(value);
  const ownedIds = new Set(
    state.sources.flatMap((item) => item.entries.map((entry) => entry.localId)),
  );
  const claimed = new Set<string>();
  const rows: SelectorImportRow[] = incoming.map((remote) => {
    const entry = source?.entries.find((item) => item.remoteId == remote.id);
    const local = entry
      ? state.items.find((item) => item.id == entry.localId)
      : !source
        ? state.items.find(
            (item) =>
              !ownedIds.has(item.id) &&
              !claimed.has(item.id) &&
              ((!source && item.id == remote.id) ||
                getSelectorPresetIdentity(item) ==
                  getSelectorPresetIdentity(remote)),
          )
        : undefined;
    if (local) claimed.add(local.id);
    let status: ImportStatus = 'added';
    if (local) {
      if (sameContent(local, remote)) status = 'unchanged';
      else status = 'updated';
    }
    return {
      key: remote.id,
      status,
      local,
      remote,
      localId:
        entry?.localId ||
        local?.id ||
        (!source && !state.items.some((item) => item.id == remote.id)
          ? remote.id
          : crypto.randomUUID()),
    };
  });
  return {
    rows,
    incoming,
    source,
    fingerprint: libraryFingerprint(state),
    checkedAt: now,
  };
};

export const applyImportPlan = (
  state: SelectorLibraryState,
  plan: SelectorImportPlan,
  now = Date.now(),
): SelectorLibraryState => {
  if (libraryFingerprint(state) != plan.fingerprint) {
    throw new Error('选择器库已改变，请重新读取并预览');
  }
  const items = [...state.items];
  for (const row of plan.rows) {
    if (!row.remote || row.status == 'unchanged') continue;
    const index = items.findIndex((item) => item.id == row.localId);
    const local = items[index];
    const next = replacePresetContent(row.remote, row.localId, local, now);
    if (index < 0) items.push(next);
    else items[index] = next;
  }
  let sources = state.sources;
  if (plan.source) {
    const source: SelectorSource = {
      ...plan.source,
      checkedAt: plan.checkedAt,
      entries: [
        ...plan.rows
          .filter((row) => row.remote)
          .map((row) => ({
            remoteId: row.key,
            localId: row.localId,
          })),
      ],
    };
    sources = [...sources.filter((item) => item.id != source.id), source];
  }
  return { items, sources };
};

export const serializeSharedLibrary = (items: readonly SelectorPreset[]) => ({
  version: 1,
  items: items.map((item) => ({
    id: item.id,
    ...selectorContent(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});

export const serializeLibraryBackup = (state: SelectorLibraryState) => ({
  ...serializeSharedLibrary(state.items),
  kind: 'gkd-selector-library-backup',
  preferences: state.items.map((item) => ({
    id: item.id,
    pinned: Boolean(item.pinned),
    pinnedAt: item.pinnedAt,
    useCount: item.useCount,
    lastUsedAt: item.lastUsedAt,
  })),
  sources: state.sources,
});

export const parseLibraryBackup = (value: unknown): SelectorLibraryState => {
  const items = parseSelectorLibraryPayload(value);
  if (
    !value ||
    typeof value != 'object' ||
    !('kind' in value) ||
    value.kind != 'gkd-selector-library-backup'
  ) {
    return { items, sources: [] };
  }
  const backup = value as Record<string, unknown>;
  if (!Array.isArray(backup.preferences) || !Array.isArray(backup.sources))
    throw new Error('备份格式无效');
  const preferences = new Map(
    backup.preferences.map((pref: unknown) => {
      if (
        !pref ||
        typeof pref != 'object' ||
        !('id' in pref) ||
        typeof pref.id != 'string'
      )
        throw new Error('备份偏好无效');
      return [pref.id, pref as Record<string, unknown>];
    }),
  );
  const restored = parseSelectorLibraryPayload(
    items.map((item) => ({
      ...item,
      pinned: preferences.get(item.id)?.pinned,
      pinnedAt: preferences.get(item.id)?.pinnedAt,
      useCount: preferences.get(item.id)?.useCount,
      lastUsedAt: preferences.get(item.id)?.lastUsedAt,
    })),
  );
  const sources = backup.sources.map((raw: unknown): SelectorSource => {
    if (!raw || typeof raw != 'object') throw new Error('备份来源无效');
    const source = raw as Record<string, unknown>;
    if (
      typeof source.id != 'string' ||
      !source.id ||
      typeof source.name != 'string' ||
      typeof source.url != 'string' ||
      typeof source.checkedAt != 'number' ||
      !Number.isFinite(source.checkedAt) ||
      !Array.isArray(source.entries)
    )
      throw new Error('备份来源无效');
    const entries = source.entries.map(
      (rawEntry: unknown): SelectorSourceEntry => {
        if (!rawEntry || typeof rawEntry != 'object')
          throw new Error('备份来源条目无效');
        const entry = rawEntry as Record<string, unknown>;
        if (
          typeof entry.remoteId != 'string' ||
          !entry.remoteId ||
          typeof entry.localId != 'string' ||
          !entry.localId
        )
          throw new Error('备份来源条目无效');
        return {
          remoteId: entry.remoteId,
          localId: entry.localId,
        };
      },
    );
    if (new Set(entries.map((entry) => entry.remoteId)).size != entries.length)
      throw new Error('备份来源条目重复');
    return {
      id: source.id,
      name: source.name,
      url: normalizeSourceUrl(source.url),
      checkedAt: source.checkedAt,
      entries,
    };
  });
  const ownedIds = sources.flatMap((source) =>
    source.entries.map((entry) => entry.localId),
  );
  if (
    new Set(ownedIds).size != ownedIds.length ||
    new Set(sources.map((source) => source.id)).size != sources.length ||
    new Set(sources.map((source) => source.url)).size != sources.length ||
    new Set(restored.map((item) => item.id)).size != restored.length
  )
    throw new Error('备份包含重复记录');
  return { items: restored, sources };
};
