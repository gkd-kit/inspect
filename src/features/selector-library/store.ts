import {
  createSelectorPreset,
  getSelectorPresetIdentity,
  mergeSelectorPresets,
  parseSelectorLibraryPayload,
  updateSelectorPreset,
  type SelectorPreset,
  type SelectorPresetInput,
} from '@/features/selector-library/library';
import {
  createSelectorLibraryStateSync,
  loadSelectorLibraryFromStorage,
  SELECTOR_LIBRARY_SYNC_NAMESPACE,
  updateSelectorLibraryInStorage,
} from '@/features/selector-library/storage';

const selectorLibraryData = shallowReactive({
  items: await loadSelectorLibraryFromStorage(),
});

let syncChannel: BroadcastChannel | undefined;

const selectorLibrarySync = createSelectorLibraryStateSync({
  load: loadSelectorLibraryFromStorage,
  update: updateSelectorLibraryInStorage,
  apply(items) {
    selectorLibraryData.items = items;
  },
  broadcast() {
    syncChannel?.postMessage('updated');
  },
});

export const selectorLibrary = readonly(selectorLibraryData) as Readonly<{
  items: readonly SelectorPreset[];
}>;

export const selectorLibraryActions = {
  async save(input: SelectorPresetInput) {
    const preset = createSelectorPreset(input, crypto.randomUUID());
    const identity = getSelectorPresetIdentity(preset);
    await selectorLibrarySync.commit((items) => {
      if (items.some((item) => getSelectorPresetIdentity(item) == identity)) {
        throw new Error('同一适用范围内已存在相同选择器');
      }
      return [...items, preset];
    });
    return preset;
  },
  async remove(id: string) {
    await selectorLibrarySync.commit((items) =>
      items.filter((item) => item.id != id),
    );
  },
  async update(
    id: string,
    input: SelectorPresetInput,
    expectedUpdatedAt?: number,
  ) {
    let updated: SelectorPreset | undefined;
    await selectorLibrarySync.commit((items) => {
      const current = items.find((item) => item.id == id);
      if (!current) throw new Error('选择器不存在或已被删除');
      if (
        expectedUpdatedAt !== undefined &&
        current.updatedAt != expectedUpdatedAt
      ) {
        throw new Error('选择器已在其他操作中更新，请重新编辑');
      }
      updated = updateSelectorPreset(current, input);
      const identity = getSelectorPresetIdentity(updated);
      if (
        items.some(
          (item) =>
            item.id != id && getSelectorPresetIdentity(item) == identity,
        )
      ) {
        throw new Error('同一适用范围内已存在相同选择器');
      }
      return items.map((item) => (item.id == id ? updated! : item));
    });
    return updated;
  },
  async markUsed(id: string) {
    await selectorLibrarySync.commit((items) => {
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
  async importItems(value: unknown) {
    const imported = parseSelectorLibraryPayload(value);
    await selectorLibrarySync.commit((items) =>
      mergeSelectorPresets(items, imported),
    );
    return imported.length;
  },
};

if (typeof BroadcastChannel != 'undefined') {
  syncChannel = new BroadcastChannel(SELECTOR_LIBRARY_SYNC_NAMESPACE);
  syncChannel.addEventListener('message', () => {
    void selectorLibrarySync.refresh().catch(() => undefined);
  });
}
