import { parseSelector } from './parser.ts';

const SELECTOR_LIBRARY_VERSION = 1;

export type SelectorPresetScope = 'global' | 'app' | 'activity';

export interface SelectorPreset {
  id: string;
  name: string;
  selector: string;
  description: string;
  tags: string[];
  scope: SelectorPresetScope;
  appId?: string;
  activityId?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

export interface SelectorPresetInput {
  name: string;
  selector: string;
  description?: string;
  tags?: string[];
  scope: SelectorPresetScope;
  appId?: string;
  activityId?: string;
}

export interface SelectorPresetContext {
  appId?: string;
  activityId?: string;
}

interface SelectorLibraryPayload {
  version: typeof SELECTOR_LIBRARY_VERSION;
  items: SelectorPreset[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value != null && !Array.isArray(value);

const normalizeText = (value: unknown) =>
  typeof value == 'string' ? value.trim() : '';

export const normalizeSelectorIdentity = (value: unknown) => {
  const source = normalizeText(value);
  if (!source) return source;
  try {
    return parseSelector(source).toString();
  } catch {
    return source;
  }
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeText).filter((tag) => tag.length > 0))];
};

const normalizeTimestamp = (value: unknown, fallback: number) =>
  typeof value == 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const normalizeScope = (value: unknown): SelectorPresetScope => {
  if (value === 'app' || value === 'activity') return value;
  return 'global';
};

export const inferSelectorPresetScope = (
  appId?: string,
  activityId?: string,
): SelectorPresetScope => {
  if (!normalizeText(appId)) return 'global';
  return normalizeText(activityId) ? 'activity' : 'app';
};

const normalizeSelectorPreset = (
  value: unknown,
  fallbackTime = Date.now(),
): SelectorPreset | undefined => {
  if (!isObject(value)) return;
  const id = normalizeText(value.id);
  const name = normalizeText(value.name);
  const selector = normalizeText(value.selector);
  if (!id || !name || !selector) return;
  try {
    parseSelector(selector);
  } catch {
    return;
  }

  let scope = normalizeScope(value.scope);
  const appId = normalizeText(value.appId) || undefined;
  const activityId = normalizeText(value.activityId) || undefined;
  if (scope == 'activity' && (!appId || !activityId)) {
    scope = appId ? 'app' : 'global';
  } else if (scope == 'app' && !appId) {
    scope = 'global';
  }

  const createdAt = normalizeTimestamp(value.createdAt, fallbackTime);
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt);
  const lastUsedAt =
    typeof value.lastUsedAt == 'number' && value.lastUsedAt > 0
      ? value.lastUsedAt
      : undefined;
  const useCount =
    typeof value.useCount == 'number' &&
    Number.isSafeInteger(value.useCount) &&
    value.useCount > 0
      ? value.useCount
      : 0;

  return {
    id,
    name,
    selector,
    description: normalizeText(value.description),
    tags: normalizeTags(value.tags),
    scope,
    ...(scope == 'global' ? {} : { appId }),
    ...(scope == 'activity' ? { activityId } : {}),
    createdAt,
    updatedAt,
    ...(lastUsedAt ? { lastUsedAt } : {}),
    useCount,
  };
};

export const parseSelectorLibraryPayload = (
  value: unknown,
): SelectorPreset[] => {
  if (
    isObject(value) &&
    'version' in value &&
    value.version !== SELECTOR_LIBRARY_VERSION
  ) {
    throw new Error(`不支持的选择器库版本：${String(value.version)}`);
  }
  const source =
    isObject(value) && Array.isArray(value.items) ? value.items : value;
  if (!Array.isArray(source)) {
    throw new Error('选择器库文件必须包含 items 数组');
  }
  return source.map((item, index) => {
    const preset = normalizeSelectorPreset(item);
    if (!preset) {
      throw new Error(`选择器库第 ${index + 1} 条数据无效`);
    }
    return preset;
  });
};

export const createSelectorPreset = (
  input: SelectorPresetInput,
  id: string,
  now = Date.now(),
): SelectorPreset => {
  const scope = normalizeScope(input.scope);
  const appId = normalizeText(input.appId) || undefined;
  const activityId = normalizeText(input.activityId) || undefined;
  if (scope == 'app' && !appId) throw new Error('应用范围缺少应用 ID');
  if (scope == 'activity' && (!appId || !activityId)) {
    throw new Error('界面范围缺少应用 ID 或界面 ID');
  }
  const preset = normalizeSelectorPreset(
    {
      ...input,
      id,
      appId,
      activityId,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    },
    now,
  );
  if (!preset) {
    if (!normalizeText(input.name) || !normalizeText(input.selector)) {
      throw new Error('名称和选择器不能为空');
    }
    parseSelector(normalizeText(input.selector));
    throw new Error('选择器数据无效');
  }
  return preset;
};

export const updateSelectorPreset = (
  current: SelectorPreset,
  input: SelectorPresetInput,
  now = Date.now(),
): SelectorPreset => {
  const updated = createSelectorPreset(input, current.id, now);
  return {
    ...updated,
    createdAt: current.createdAt,
    ...(current.lastUsedAt ? { lastUsedAt: current.lastUsedAt } : {}),
    useCount: current.useCount,
  };
};

export const getSelectorPresetIdentity = (preset: SelectorPreset) =>
  [
    preset.scope,
    preset.appId || '',
    preset.activityId || '',
    normalizeSelectorIdentity(preset.selector),
  ].join('\u0000');

const mergeSelectorPresetItems = (
  items: readonly SelectorPreset[],
  id: string,
): SelectorPreset => {
  const metadata = items.reduce((latest, item) =>
    item.updatedAt >= latest.updatedAt ? item : latest,
  );
  return {
    ...metadata,
    id,
    createdAt: Math.min(...items.map((item) => item.createdAt)),
    updatedAt: Math.max(...items.map((item) => item.updatedAt)),
    lastUsedAt:
      Math.max(...items.map((item) => item.lastUsedAt || 0)) || undefined,
    useCount: Math.max(...items.map((item) => item.useCount)),
    tags: [...new Set(items.flatMap((item) => item.tags))],
  };
};

const hasSelectorPresetEditableContentChanged = (
  previous: SelectorPreset,
  next: SelectorPreset,
) =>
  previous.name != next.name ||
  previous.selector != next.selector ||
  previous.description != next.description ||
  previous.scope != next.scope ||
  previous.appId != next.appId ||
  previous.activityId != next.activityId ||
  previous.tags.length != next.tags.length ||
  previous.tags.some((tag, index) => tag != next.tags[index]);

export const mergeSelectorPresets = (
  current: readonly SelectorPreset[],
  incoming: readonly SelectorPreset[],
  now = Date.now(),
): SelectorPreset[] => {
  const result = current.map((item) => ({ ...item, tags: [...item.tags] }));
  const identityByIndex: string[] = [];
  const indexById = new Map<string, number>();
  const indexByIdentity = new Map<string, number>();
  const rebuildIndexes = () => {
    identityByIndex.length = 0;
    indexById.clear();
    indexByIdentity.clear();
    result.forEach((item, index) => {
      const identity = getSelectorPresetIdentity(item);
      identityByIndex.push(identity);
      if (!indexById.has(item.id)) indexById.set(item.id, index);
      if (!indexByIdentity.has(identity)) {
        indexByIdentity.set(identity, index);
      }
    });
  };
  rebuildIndexes();

  for (const item of incoming) {
    const identity = getSelectorPresetIdentity(item);
    const index = indexById.get(item.id) ?? indexByIdentity.get(identity);
    if (index === undefined) {
      const nextIndex = result.length;
      result.push({ ...item, tags: [...item.tags] });
      identityByIndex.push(identity);
      indexById.set(item.id, nextIndex);
      indexByIdentity.set(identity, nextIndex);
    } else {
      const existing = result[index];
      let merged = mergeSelectorPresetItems([existing, item], existing.id);
      const collisionIndex = indexByIdentity.get(
        getSelectorPresetIdentity(merged),
      );
      if (collisionIndex !== undefined && collisionIndex != index) {
        merged = mergeSelectorPresetItems(
          [existing, result[collisionIndex], item],
          existing.id,
        );
      }
      if (
        hasSelectorPresetEditableContentChanged(existing, merged) &&
        merged.updatedAt <= existing.updatedAt
      ) {
        merged.updatedAt = Math.max(now, existing.updatedAt + 1);
      }

      if (collisionIndex !== undefined && collisionIndex != index) {
        result[index] = merged;
        result.splice(collisionIndex, 1);
        rebuildIndexes();
        continue;
      }
      const previousIdentity = identityByIndex[index];
      const nextIdentity = getSelectorPresetIdentity(merged);
      result[index] = merged;
      identityByIndex[index] = nextIdentity;
      if (indexByIdentity.get(previousIdentity) == index) {
        indexByIdentity.delete(previousIdentity);
      }
      if (!indexByIdentity.has(nextIdentity)) {
        indexByIdentity.set(nextIdentity, index);
      }
    }
  }
  return result;
};

const matchesSelectorPresetContext = (
  preset: SelectorPreset,
  context?: SelectorPresetContext,
) => {
  if (!context) return true;
  if (preset.scope == 'global') return true;
  if (preset.appId != context.appId) return false;
  return preset.scope != 'activity' || preset.activityId == context.activityId;
};

export const getSelectorPresetScopeLabel = (preset: SelectorPreset) => {
  if (preset.scope == 'activity') return `界面 · ${preset.activityId}`;
  if (preset.scope == 'app') return `应用 · ${preset.appId}`;
  return '全局';
};

export const collectSelectorPresetIdentities = (
  items: readonly SelectorPreset[],
  context?: SelectorPresetContext,
) =>
  new Set(
    items
      .filter((item) => matchesSelectorPresetContext(item, context))
      .map((item) => normalizeSelectorIdentity(item.selector)),
  );

const getScopeRank = (preset: SelectorPreset) => {
  if (preset.scope == 'activity') return 2;
  if (preset.scope == 'app') return 1;
  return 0;
};

export const filterSelectorPresets = (
  items: readonly SelectorPreset[],
  query: string,
  context?: SelectorPresetContext,
): SelectorPreset[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items
    .filter((item) => matchesSelectorPresetContext(item, context))
    .filter((item) => {
      if (!normalizedQuery) return true;
      return [
        item.name,
        item.selector,
        item.description,
        item.appId || '',
        item.activityId || '',
        ...item.tags,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .toSorted((a, b) => {
      const scopeDiff = getScopeRank(b) - getScopeRank(a);
      if (scopeDiff) return scopeDiff;
      const usedDiff = (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      if (usedDiff) return usedDiff;
      return b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);
    });
};

export const collectSelectorPresetTags = (
  items: readonly SelectorPreset[],
): string[] =>
  [...new Set(items.flatMap((item) => item.tags))].toSorted((a, b) =>
    a.localeCompare(b),
  );

export const serializeSelectorLibrary = (
  items: readonly SelectorPreset[],
): SelectorLibraryPayload => ({
  version: SELECTOR_LIBRARY_VERSION,
  items: items.map((item) => ({ ...item, tags: [...item.tags] })),
});
