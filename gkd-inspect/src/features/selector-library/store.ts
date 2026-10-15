import {
  createSelectorPreset,
  getSelectorPresetIdentity,
  updateSelectorPreset,
  setSelectorPresetPinned,
  type SelectorPreset,
  type SelectorPresetInput,
} from '@/features/selector-library/library';
import {
  createSelectorLibraryStateSync,
  loadLibraryState,
  SELECTOR_LIBRARY_SYNC_NAMESPACE,
  updateLibraryState,
} from '@/features/selector-library/storage';
import {
  applyImportPlan,
  createImportPlan,
  getSelectorSource,
  replaceSourceItems,
  removeSelectorSource,
  libraryFingerprint,
  normalizeSourceUrl,
  type SelectorImportPlan,
  type SelectorLibraryState,
  type SelectorSource,
} from '@/entities/selector-library/sync';

const selectorLibraryData = shallowReactive({
  ...(await loadLibraryState()),
});

let syncChannel: BroadcastChannel | undefined;

const selectorLibrarySync = createSelectorLibraryStateSync({
  load: loadLibraryState,
  update: updateLibraryState,
  apply(state) {
    Object.assign(selectorLibraryData, state);
  },
  broadcast() {
    syncChannel?.postMessage('updated');
  },
});

export const selectorLibrary = readonly(selectorLibraryData) as Readonly<{
  items: readonly SelectorPreset[];
  sources: readonly SelectorSource[];
}>;

const commitItems = (updater: (items: SelectorPreset[]) => SelectorPreset[]) =>
  selectorLibrarySync.commit((state) => {
    const items = updater(state.items);
    return items === state.items ? state : { ...state, items };
  });

export const selectorLibraryActions = {
  async setPinned(id: string, pinned: boolean) {
    await commitItems((items) => setSelectorPresetPinned(items, id, pinned));
  },
  previewImport(value: unknown, source?: SelectorSource) {
    return createImportPlan(selectorLibraryData, value, source);
  },
  async confirmImport(plan: SelectorImportPlan) {
    await selectorLibrarySync.commit((state) => applyImportPlan(state, plan));
  },
  async refreshSource(
    source: SelectorSource,
    value: unknown,
    signal?: AbortSignal,
  ) {
    let changed = false;
    await selectorLibrarySync.commit((state) => {
      signal?.throwIfAborted();
      const next = replaceSourceItems(state, source, value);
      changed = next !== state;
      return next;
    });
    return changed;
  },
  async restoreBackup(backup: SelectorLibraryState, fingerprint: string) {
    await selectorLibrarySync.commit((state) => {
      if (libraryFingerprint(state) != fingerprint)
        throw new Error('选择器库已改变，请重新读取备份');
      return backup;
    });
  },
  async updateSource(id: string, name: string, url: string) {
    const normalized = normalizeSourceUrl(url);
    await selectorLibrarySync.commit((state) => {
      if (
        state.sources.some(
          (source) => source.id != id && source.url == normalized,
        )
      )
        throw new Error('该来源地址已存在');
      if (!state.sources.some((source) => source.id == id))
        throw new Error('来源已被移除');
      return {
        ...state,
        sources: state.sources.map((source) =>
          source.id == id
            ? { ...source, name: name.trim() || normalized, url: normalized }
            : source,
        ),
      };
    });
  },
  async removeSource(id: string) {
    await selectorLibrarySync.commit((state) =>
      removeSelectorSource(state, id),
    );
  },
  async save(input: SelectorPresetInput) {
    const preset = createSelectorPreset(input, crypto.randomUUID());
    const identity = getSelectorPresetIdentity(preset);
    await commitItems((items) => {
      if (items.some((item) => getSelectorPresetIdentity(item) == identity)) {
        throw new Error('同一适用范围内已存在相同选择器');
      }
      return [...items, preset];
    });
    return preset;
  },
  async remove(id: string) {
    await selectorLibrarySync.commit((state) => {
      if (getSelectorSource(state.sources, id))
        throw new Error('远程选择器由来源维护，不能单独删除');
      return { ...state, items: state.items.filter((item) => item.id != id) };
    });
  },
  async update(
    id: string,
    input: SelectorPresetInput,
    expectedUpdatedAt?: number,
  ) {
    let updated: SelectorPreset | undefined;
    await selectorLibrarySync.commit((state) => {
      if (getSelectorSource(state.sources, id))
        throw new Error('远程选择器由来源维护，不能直接编辑');
      const items = state.items;
      const current = items.find((item) => item.id == id);
      if (!current) throw new Error('选择器不存在或已被删除');
      if (
        expectedUpdatedAt !== undefined &&
        current.updatedAt != expectedUpdatedAt
      ) {
        throw new Error('选择器已在其他操作中更新，请重新编辑');
      }
      updated = updateSelectorPreset(current, input);
      if (updated === current) {
        updated = undefined;
        return state;
      }
      const identity = getSelectorPresetIdentity(updated);
      if (
        getSelectorPresetIdentity(current) != identity &&
        items.some(
          (item) =>
            item.id != id && getSelectorPresetIdentity(item) == identity,
        )
      ) {
        throw new Error('同一适用范围内已存在相同选择器');
      }
      return {
        ...state,
        items: items.map((item) => (item.id == id ? updated! : item)),
      };
    });
    return updated;
  },
  async markUsed(id: string) {
    await commitItems((items) => {
      const now = Date.now();
      return items.map((item) =>
        item.id == id
          ? {
              ...item,
              lastUsedAt: now,
              useCount: item.useCount + 1,
            }
          : item,
      );
    });
  },
};

if (typeof BroadcastChannel != 'undefined') {
  syncChannel = new BroadcastChannel(SELECTOR_LIBRARY_SYNC_NAMESPACE);
  syncChannel.addEventListener('message', () => {
    void selectorLibrarySync.refresh().catch(() => undefined);
  });
}
