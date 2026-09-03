<script setup lang="ts">
import SelectorSyntaxInput from '@/components/base/SelectorSyntaxInput.vue';
import SelectorText from '@/components/selector/SelectorText.vue';
import {
  collectSelectorPresetTags,
  filterSelectorPresets,
  getSelectorPresetScopeLabel,
  inferSelectorPresetScope,
  serializeSelectorLibrary,
  type SelectorPreset,
  type SelectorPresetInput,
  type SelectorPresetScope,
} from '@/domain/selector/library';
import {
  selectorLibrary,
  selectorLibraryActions,
} from '@/store/selector_library';
import { message } from '@/utils/discrete';
import { copy } from '@/utils/others';
import { saveAs } from 'file-saver';
import * as base64url from 'universal-base64url';
import PageBackButton from '@/components/base/PageBackButton.vue';

type ScopeFilter = 'all' | SelectorPresetScope;

const query = shallowRef('');
const scopeFilter = shallowRef<ScopeFilter>('all');
const localFileInput = shallowRef<HTMLInputElement>();
const createInitialForm = () => ({
  id: undefined as string | undefined,
  updatedAt: undefined as number | undefined,
  name: '',
  selector: '',
  description: '',
  tags: [] as string[],
  appId: '',
  activityId: '',
});
const form = shallowReactive(createInitialForm());
const savePending = shallowRef(false);
const importPending = shallowRef(false);
let editorRevision = 0;

const scopeFilterOptions = [
  { label: '全部范围', value: 'all' },
  { label: '全局', value: 'global' },
  { label: '应用内全部界面', value: 'app' },
  { label: '指定界面', value: 'activity' },
];
const visibleItems = computed(() =>
  filterSelectorPresets(selectorLibrary.items, query.value).filter(
    (item) => scopeFilter.value == 'all' || item.scope == scopeFilter.value,
  ),
);
const tagOptions = computed(() =>
  collectSelectorPresetTags(selectorLibrary.items).map((tag) => ({
    label: tag,
    value: tag,
  })),
);
const editorTitle = computed(() => (form.id ? '编辑选择器' : '新增选择器'));

const getTestRoute = (selector: string) => ({
  path: '/selector',
  query: { gkd: base64url.encode(selector) },
});
const updateQuery = (value: string) => {
  query.value = value;
};
const updateScopeFilter = (value: ScopeFilter) => {
  scopeFilter.value = value;
};
const updateName = (value: string) => {
  form.name = value;
  editorRevision += 1;
};
const updateSelector = (value: string) => {
  form.selector = value;
  editorRevision += 1;
};
const updateDescription = (value: string) => {
  form.description = value;
  editorRevision += 1;
};
const updateTags = (value: string[]) => {
  form.tags = [
    ...new Set(value.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  ];
  editorRevision += 1;
};
const updateAppId = (value: string) => {
  form.appId = value;
  if (!value.trim()) form.activityId = '';
  editorRevision += 1;
};
const updateActivityId = (value: string) => {
  form.activityId = value;
  editorRevision += 1;
};
const resetEditor = () => {
  Object.assign(form, createInitialForm());
  editorRevision += 1;
};
const editPreset = (preset: SelectorPreset) => {
  form.id = preset.id;
  form.updatedAt = preset.updatedAt;
  form.name = preset.name;
  form.selector = preset.selector;
  form.description = preset.description;
  form.tags = [...preset.tags];
  form.appId = preset.appId || '';
  form.activityId = preset.activityId || '';
  editorRevision += 1;
};
const getFormInput = (): SelectorPresetInput => ({
  name: form.name,
  selector: form.selector,
  description: form.description,
  tags: form.tags,
  scope: inferSelectorPresetScope(form.appId, form.activityId),
  appId: form.appId,
  activityId: form.activityId,
});
const savePreset = async () => {
  if (savePending.value) return;
  const revision = editorRevision;
  const id = form.id;
  const updatedAt = form.updatedAt;
  const input = getFormInput();
  savePending.value = true;
  try {
    const editing = Boolean(id);
    const saved = id
      ? await selectorLibraryActions.update(id, input, updatedAt)
      : await selectorLibraryActions.save(input);
    message.success(editing ? '选择器已更新' : '选择器已收藏');
    if (revision == editorRevision) {
      resetEditor();
    } else if (saved && form.id == id) {
      form.updatedAt = saved.updatedAt;
    } else if (
      saved &&
      !id &&
      !form.id &&
      form.selector.trim() == input.selector.trim()
    ) {
      form.id = saved.id;
      form.updatedAt = saved.updatedAt;
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    savePending.value = false;
  }
};
const removePreset = async (id: string) => {
  try {
    await selectorLibraryActions.remove(id);
    if (form.id == id) resetEditor();
    message.success('选择器已删除');
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
};
const copySelector = (selector: string) => {
  void copy(selector);
};
const exportLibrary = () => {
  const content = JSON.stringify(
    serializeSelectorLibrary(selectorLibrary.items),
    undefined,
    2,
  );
  saveAs(
    new Blob([content], { type: 'application/json;charset=utf-8' }),
    'gkd-selector-library.json',
  );
};
const openImportFile = () => {
  localFileInput.value?.click();
};
const importLibrary = async () => {
  if (importPending.value) return;
  const input = localFileInput.value;
  const file = input?.files?.[0];
  if (!input || !file) return;
  input.value = '';
  importPending.value = true;
  try {
    const count = await selectorLibraryActions.importItems(
      JSON.parse(await file.text()),
    );
    message.success(`已导入 ${count} 条选择器`);
  } catch (error) {
    message.error(
      `导入失败：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    importPending.value = false;
  }
};
</script>

<template>
  <div class="page-size flex flex-col gap-12px overflow-hidden p-12px">
    <div class="flex items-center gap-12px">
      <PageBackButton />
      <SvgIcon name="selector-library" class="text-24px" />
      <span class="text-20px font-600">选择器库</span>
      <NTag size="small" :bordered="false">
        {{ selectorLibrary.items.length }} 条
      </NTag>
      <div flex-1 />
      <NButton :loading="importPending" @click="openImportFile">导入</NButton>
      <NButton
        :disabled="selectorLibrary.items.length == 0"
        @click="exportLibrary"
      >
        导出
      </NButton>
      <input
        ref="localFileInput"
        hidden
        type="file"
        accept=".json,application/json"
        @change="importLibrary"
      />
    </div>

    <div class="library-body flex min-h-0 flex-1 gap-12px">
      <NCard
        :title="editorTitle"
        size="small"
        class="library-editor w-360px shrink-0 overflow-auto"
      >
        <NForm labelPlacement="top">
          <NFormItem label="名称">
            <NInput
              :value="form.name"
              placeholder="例如：关闭按钮"
              @update:value="updateName"
            />
          </NFormItem>
          <NFormItem label="选择器">
            <SelectorSyntaxInput
              :value="form.selector"
              placeholder="请输入合法的选择器"
              :autosize="{ minRows: 4, maxRows: 8 }"
              hint="输入后自动校验选择器语法"
              @update:value="updateSelector"
            />
          </NFormItem>
          <NFormItem label="适用应用">
            <NInput
              :value="form.appId"
              placeholder="留空表示全局"
              @update:value="updateAppId"
            />
          </NFormItem>
          <NFormItem label="适用界面">
            <NInput
              :value="form.activityId"
              :disabled="!form.appId.trim()"
              placeholder="留空表示该应用内全部界面"
              @update:value="updateActivityId"
            />
          </NFormItem>
          <NFormItem label="标签">
            <NSelect
              :value="form.tags"
              :options="tagOptions"
              multiple
              filterable
              tag
              clearable
              maxTagCount="responsive"
              placeholder="选择已有标签或输入新标签"
              @update:value="updateTags"
            />
          </NFormItem>
          <NFormItem label="说明">
            <NInput
              :value="form.description"
              type="textarea"
              placeholder="记录用途或注意事项"
              :autosize="{ minRows: 2, maxRows: 5 }"
              @update:value="updateDescription"
            />
          </NFormItem>
        </NForm>
        <div class="flex justify-end gap-8px">
          <NButton v-if="form.id" @click="resetEditor">取消编辑</NButton>
          <NButton
            type="primary"
            :loading="savePending"
            :disabled="!form.name.trim() || !form.selector.trim()"
            @click="savePreset"
          >
            {{ form.id ? '保存修改' : '添加到库' }}
          </NButton>
        </div>
      </NCard>

      <NCard
        size="small"
        class="library-results min-h-0 min-w-0 flex-1 overflow-hidden"
        contentClass="flex min-h-0 flex-col"
      >
        <div class="mb-12px flex shrink-0 items-center gap-8px">
          <NInput
            :value="query"
            clearable
            placeholder="搜索名称、选择器、标签、应用或界面"
            @update:value="updateQuery"
          />
          <NSelect
            :value="scopeFilter"
            :options="scopeFilterOptions"
            class="w-140px shrink-0"
            @update:value="updateScopeFilter"
          />
        </div>

        <NScrollbar class="library-list min-h-0 flex-1">
          <div v-if="visibleItems.length" class="flex flex-col gap-10px pr-8px">
            <div
              v-for="preset in visibleItems"
              :key="preset.id"
              class="app-panel rounded-6px border p-12px"
            >
              <div class="flex flex-wrap items-center gap-8px">
                <span class="text-16px font-600">{{ preset.name }}</span>
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
                v-if="preset.description"
                class="mt-6px text-13px"
                style="color: var(--app-muted)"
              >
                {{ preset.description }}
              </div>
              <div
                class="app-subtle mt-8px break-all rounded-4px p-8px gkd_code text-13px"
              >
                <SelectorText :source="preset.selector" />
              </div>
              <div class="mt-10px flex justify-end gap-8px">
                <NButton size="small" @click="copySelector(preset.selector)">
                  复制
                </NButton>
                <RouterLink :to="getTestRoute(preset.selector)">
                  <NButton size="small">测试</NButton>
                </RouterLink>
                <NButton size="small" @click="editPreset(preset)">
                  编辑
                </NButton>
                <NPopconfirm @positiveClick="removePreset(preset.id)">
                  <template #trigger>
                    <NButton size="small" type="error" secondary>
                      删除
                    </NButton>
                  </template>
                  删除选择器“{{ preset.name }}”？
                </NPopconfirm>
              </div>
            </div>
          </div>
          <NEmpty v-else description="没有匹配的选择器" />
        </NScrollbar>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 800px) {
  .library-body {
    flex-direction: column;
    overflow: auto;
  }

  .library-editor {
    width: auto;
    flex: none;
  }

  .library-results {
    flex: none;
  }

  .library-list {
    height: 60vh;
    flex: none;
  }
}
</style>
