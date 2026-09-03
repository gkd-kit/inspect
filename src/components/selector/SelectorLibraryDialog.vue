<script setup lang="ts">
import SelectorText from '@/components/selector/SelectorText.vue';
import {
  filterSelectorPresets,
  getSelectorPresetScopeLabel,
  type SelectorPreset,
  type SelectorPresetScope,
} from '@/domain/selector/library';
import {
  selectorLibrary,
  selectorLibraryActions,
} from '@/store/selector_library';
import { message } from '@/utils/discrete';

const props = defineProps<{
  show: boolean;
  initialSelector?: string;
  appId?: string;
  activityId?: string;
  allowSave?: boolean;
}>();

const emit = defineEmits<{
  use: [selector: string];
  'update:show': [show: boolean];
}>();

const query = shallowRef('');
const draft = shallowReactive({
  name: '',
  scope: (props.appId ? 'app' : 'global') as SelectorPresetScope,
});
const savePending = shallowRef(false);
const removingPresetId = shallowRef<string>();
let draftRevision = 0;

const context = computed(() => {
  if (!props.appId) return;
  return { appId: props.appId, activityId: props.activityId };
});
const visibleItems = computed(() =>
  filterSelectorPresets(selectorLibrary.items, query.value, context.value),
);
const canQuickSave = computed(
  () => props.allowSave && Boolean(props.initialSelector?.trim()),
);
const scopeOptions = computed(() => {
  const options = [{ label: '全局', value: 'global' }];
  if (props.appId) options.push({ label: '当前应用', value: 'app' });
  if (props.appId && props.activityId) {
    options.push({ label: '当前界面', value: 'activity' });
  }
  return options;
});

const updateQuery = (value: string) => {
  query.value = value;
};
const updateName = (value: string) => {
  draft.name = value;
  draftRevision += 1;
};
const updateScope = (value: SelectorPresetScope) => {
  draft.scope = value;
  draftRevision += 1;
};
const resetDialogState = () => {
  query.value = '';
  draft.name = '';
  draft.scope = props.appId ? 'app' : 'global';
  draftRevision += 1;
};
const setDialogVisible = (show: boolean) => {
  emit('update:show', show);
};
const closeDialog = () => {
  setDialogVisible(false);
};
const usePreset = (preset: SelectorPreset) => {
  emit('use', preset.selector);
  closeDialog();
  void selectorLibraryActions.markUsed(preset.id).catch((error: unknown) => {
    message.warning(
      `使用统计保存失败：${error instanceof Error ? error.message : String(error)}`,
    );
  });
};
const removePreset = async (preset: SelectorPreset) => {
  if (removingPresetId.value) return;
  removingPresetId.value = preset.id;
  try {
    await selectorLibraryActions.remove(preset.id);
    message.success(`选择器“${preset.name}”已删除`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    removingPresetId.value = undefined;
  }
};
const saveCurrentSelector = async () => {
  if (savePending.value) return;
  const selector = props.initialSelector?.trim();
  if (!selector) return;
  const revision = draftRevision;
  savePending.value = true;
  try {
    await selectorLibraryActions.save({
      name: draft.name,
      selector,
      scope: draft.scope,
      appId: props.appId,
      activityId: props.activityId,
    });
    if (
      revision == draftRevision &&
      selector == props.initialSelector?.trim()
    ) {
      draft.name = '';
      draftRevision += 1;
      message.success('选择器已收藏');
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    savePending.value = false;
  }
};
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="选择器库"
    class="w-720px max-w-[calc(100vw-48px)]"
    :maskClosable="false"
    @update:show="setDialogVisible"
    @afterLeave="resetDialogState"
  >
    <NInput
      :value="query"
      clearable
      placeholder="搜索名称、选择器、标签或适用范围"
      @update:value="updateQuery"
    />

    <template v-if="canQuickSave">
      <div class="app-divider" />
      <div class="flex items-center gap-8px">
        <NInput
          :value="draft.name"
          :disabled="savePending"
          placeholder="为当前选择器命名"
          @update:value="updateName"
        />
        <NSelect
          :value="draft.scope"
          :disabled="savePending"
          :options="scopeOptions"
          class="w-140px shrink-0"
          @update:value="updateScope"
        />
        <NButton
          type="primary"
          :loading="savePending"
          :disabled="!draft.name.trim()"
          @click="saveCurrentSelector"
        >
          快速收藏
        </NButton>
      </div>
      <NEllipsis
        class="mt-6px block gkd_code text-12px"
        style="color: var(--app-muted)"
      >
        <SelectorText :source="initialSelector || ''" />
      </NEllipsis>
    </template>

    <div class="app-divider" />

    <NScrollbar class="max-h-420px">
      <div v-if="visibleItems.length" class="flex flex-col gap-8px pr-8px">
        <div
          v-for="preset in visibleItems"
          :key="preset.id"
          class="app-panel rounded-6px border p-10px"
        >
          <div class="flex items-center gap-8px">
            <span class="font-600">{{ preset.name }}</span>
            <NTag size="small" :bordered="false">
              {{ getSelectorPresetScopeLabel(preset) }}
            </NTag>
            <NTag v-for="tag in preset.tags" :key="tag" size="small">
              {{ tag }}
            </NTag>
            <span class="ml-auto text-12px" style="color: var(--app-muted)">
              使用 {{ preset.useCount }} 次
            </span>
          </div>
          <div
            class="app-subtle mt-5px break-all rounded-4px p-8px gkd_code text-13px"
          >
            <SelectorText :source="preset.selector" />
          </div>
          <div class="mt-8px flex justify-end gap-8px">
            <NButton size="small" type="primary" @click="usePreset(preset)">
              使用
            </NButton>
            <NPopconfirm @positiveClick="removePreset(preset)">
              <template #trigger>
                <NButton
                  size="small"
                  type="error"
                  secondary
                  :loading="removingPresetId == preset.id"
                  >删除</NButton
                >
              </template>
              删除选择器“{{ preset.name }}”？
            </NPopconfirm>
          </div>
        </div>
      </div>
      <NEmpty v-else description="没有匹配的选择器" />
    </NScrollbar>

    <template #footer>
      <div class="flex justify-end">
        <RouterLink to="/selector/library" @click="closeDialog">
          <NButton text type="primary">管理全部选择器</NButton>
        </RouterLink>
      </div>
    </template>
  </NModal>
</template>
