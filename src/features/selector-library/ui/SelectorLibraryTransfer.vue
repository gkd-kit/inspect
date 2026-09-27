<script setup lang="ts">
import { saveAs } from 'file-saver';
import { selectorLibrary, selectorLibraryActions } from '../store';
import { fetchSelectorLibrary } from '../network';
import {
  libraryFingerprint,
  normalizeSourceUrl,
  parseLibraryBackup,
  serializeLibraryBackup,
  serializeSharedLibrary,
  type ImportStatus,
  type SelectorImportPlan,
  type SelectorLibraryState,
  type SelectorSource,
} from '@/entities/selector-library/sync';
import SelectorText from '@/entities/selector/ui/SelectorText.vue';
import { message } from '@/shared/services/feedback';

const show = shallowRef(false);
const pending = shallowRef(false);
const applying = shallowRef(false);
const fileInput = shallowRef<HTMLInputElement>();
const url = shallowRef('');
const sourceName = shallowRef('');
const saveSource = shallowRef(true);
const editingSourceId = shallowRef<string>();
const plan = shallowRef<SelectorImportPlan>();
const backup = shallowRef<SelectorLibraryState>();
const backupFingerprint = shallowRef('');
const errors = shallowRef<Record<string, string>>({});
const errorText = shallowRef('');
let revision = 0;
let controller: AbortController | undefined;
let loadedUrl: { value: unknown; source: SelectorSource } | undefined;
const labels: Record<ImportStatus, string> = {
  added: '新增',
  updated: '更新',
  unchanged: '未变化',
};
const summary = computed(() =>
  Object.entries(labels)
    .map(
      ([key, label]) =>
        `${label} ${plan.value?.rows.filter((row) => row.status == key).length || 0}`,
    )
    .join(' · '),
);
const appliedSummary = computed(() => {
  const rows = plan.value?.rows || [];
  const added = rows.filter((row) => row.status == 'added').length;
  const updated = rows.filter((row) => row.status == 'updated').length;
  return `新增 ${added} 条、更新 ${updated} 条，其余 ${rows.length - added - updated} 条保留本地内容`;
});
const getState = (): SelectorLibraryState => ({
  items: [...selectorLibrary.items],
  sources: [...selectorLibrary.sources],
});
const reportError = (error: unknown) => {
  errorText.value = error instanceof Error ? error.message : String(error);
  message.error(errorText.value);
};
const resetPreview = () => {
  loadedUrl = undefined;
  errorText.value = '';
  plan.value = undefined;
  backup.value = undefined;
};
const setVisible = (value: boolean) => {
  if (applying.value) return;
  show.value = value;
  revision += 1;
  controller?.abort();
  pending.value = false;
  resetPreview();
};
const openImport = () => setVisible(true);
const setUrl = (value: string) => {
  url.value = value;
  resetPreview();
};
const setName = (value: string) => {
  sourceName.value = value;
  if (loadedUrl && plan.value?.source) {
    plan.value = {
      ...plan.value,
      source: {
        ...plan.value.source,
        name: value.trim() || new URL(loadedUrl.source.url).hostname,
      },
    };
  }
};
const rebuildUrlPreview = () => {
  if (!loadedUrl) return;
  errorText.value = '';
  try {
    plan.value = selectorLibraryActions.previewImport(
      loadedUrl.value,
      saveSource.value
        ? {
            ...loadedUrl.source,
            name:
              sourceName.value.trim() || new URL(loadedUrl.source.url).hostname,
          }
        : undefined,
    );
  } catch (error) {
    plan.value = undefined;
    reportError(error);
  }
};
const setSaveSource = (value: boolean) => {
  saveSource.value = value;
  rebuildUrlPreview();
};
const readUrl = async (existing?: SelectorSource) => {
  if (pending.value || applying.value) return;
  if (!existing) resetPreview();
  const requestRevision = ++revision;
  controller = new AbortController();
  pending.value = true;
  try {
    const address = normalizeSourceUrl(existing?.url || url.value);
    if (
      !existing &&
      saveSource.value &&
      selectorLibrary.sources.some((source) => source.url == address)
    )
      throw new Error('该来源已保存，请使用来源列表中的“检查更新”');
    const source = existing || {
      id: crypto.randomUUID(),
      name: sourceName.value.trim() || new URL(address).hostname,
      url: address,
      checkedAt: 0,
      entries: [],
    };
    const value = await fetchSelectorLibrary(address, controller.signal);
    if (requestRevision != revision) return;
    if (existing) {
      applying.value = true;
      const changed = await selectorLibraryActions.refreshSource(
        source,
        value,
        controller.signal,
      );
      if (requestRevision != revision) return;
      errors.value = { ...errors.value, [existing.id]: '' };
      errorText.value = '';
      if (changed) message.success('更新成功');
      else message.info('没有更新');
    } else {
      loadedUrl = { value, source };
      rebuildUrlPreview();
    }
    if (existing) errors.value = { ...errors.value, [existing.id]: '' };
  } catch (error) {
    if (requestRevision != revision) return;
    if (existing)
      errors.value = {
        ...errors.value,
        [existing.id]: error instanceof Error ? error.message : String(error),
      };
    reportError(
      existing
        ? new Error(
            `更新失败：${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          )
        : error,
    );
  } finally {
    if (requestRevision == revision) {
      pending.value = false;
      applying.value = false;
    }
  }
};
const openFile = () => fileInput.value?.click();
const readFile = async () => {
  const file = fileInput.value?.files?.[0];
  if (!file || pending.value || applying.value) return;
  fileInput.value!.value = '';
  resetPreview();
  const requestRevision = ++revision;
  pending.value = true;
  try {
    const value = JSON.parse(await file.text());
    if (requestRevision != revision) return;
    if (value?.kind == 'gkd-selector-library-backup') {
      backup.value = parseLibraryBackup(value);
      backupFingerprint.value = libraryFingerprint(getState());
    } else plan.value = selectorLibraryActions.previewImport(value);
  } catch (error) {
    if (requestRevision == revision) reportError(error);
  } finally {
    if (requestRevision == revision) pending.value = false;
  }
};
const confirmImport = async () => {
  if (applying.value || pending.value) return;
  applying.value = true;
  try {
    if (backup.value)
      await selectorLibraryActions.restoreBackup(
        backup.value,
        backupFingerprint.value,
      );
    else if (plan.value) await selectorLibraryActions.confirmImport(plan.value);
    else return;
    message.success(
      backup.value ? '完整备份已恢复' : `导入完成：${appliedSummary.value}`,
    );
    resetPreview();
  } catch (error) {
    reportError(error);
  } finally {
    applying.value = false;
  }
};
const editSource = (source: SelectorSource) => {
  resetPreview();
  editingSourceId.value = source.id;
  url.value = source.url;
  sourceName.value = source.name;
};
const cancelEdit = () => {
  editingSourceId.value = undefined;
  url.value = '';
  sourceName.value = '';
  resetPreview();
};
const saveSourceChanges = async () => {
  if (!editingSourceId.value || applying.value) return;
  applying.value = true;
  try {
    await selectorLibraryActions.updateSource(
      editingSourceId.value,
      sourceName.value,
      url.value,
    );
    cancelEdit();
    message.success('来源已保存');
  } catch (error) {
    reportError(error);
  } finally {
    applying.value = false;
  }
};
const removeSource = async (id: string) => {
  if (applying.value || pending.value) return;
  applying.value = true;
  try {
    await selectorLibraryActions.removeSource(id);
    if (editingSourceId.value == id) cancelEdit();
    resetPreview();
    message.success('已移除来源及其选择器');
  } catch (error) {
    reportError(error);
  } finally {
    applying.value = false;
  }
};
const exportLibrary = (full: boolean) => {
  const payload = full
    ? serializeLibraryBackup(getState())
    : serializeSharedLibrary(selectorLibrary.items);
  saveAs(
    new Blob([JSON.stringify(payload, undefined, 2)], {
      type: 'application/json;charset=utf-8',
    }),
    full ? 'gkd-selector-library-backup.json' : 'gkd-selector-library.json',
  );
};
const disposeRequest = () => {
  revision += 1;
  controller?.abort();
};
onBeforeUnmount(disposeRequest);
</script>

<template>
  <div class="flex flex-wrap gap-8px">
    <NButton @click="openImport">导入 / 来源管理</NButton>
    <NButton
      :disabled="!selectorLibrary.items.length"
      @click="exportLibrary(false)"
      >分享导出</NButton
    >
    <NButton @click="exportLibrary(true)">完整备份</NButton>
  </div>
  <NModal
    :show="show"
    preset="card"
    title="导入与来源管理"
    class="w-880px max-w-[calc(100vw-32px)]"
    :maskClosable="false"
    @update:show="setVisible"
  >
    <NScrollbar class="max-h-[75vh]">
      <div class="flex flex-col gap-12px pr-8px">
        <div v-if="errorText" role="alert" class="text-red-500">
          {{ errorText }}
        </div>
        <div class="flex flex-wrap gap-8px">
          <NButton :disabled="pending || applying" @click="openFile"
            >从本地文件导入</NButton
          >
          <input
            ref="fileInput"
            hidden
            type="file"
            accept=".json,application/json"
            @change="readFile"
          />
        </div>
        <NInput
          :value="url"
          :disabled="pending || applying"
          placeholder="选择器库的 HTTP / HTTPS 链接"
          @update:value="setUrl"
        />
        <NInput
          :value="sourceName"
          :disabled="pending || applying"
          placeholder="来源名称（可选）"
          @update:value="setName"
        />
        <div class="flex flex-wrap items-center gap-8px">
          <template v-if="editingSourceId">
            <NButton :loading="applying" @click="saveSourceChanges"
              >保存来源修改</NButton
            >
            <NButton :disabled="applying" @click="cancelEdit">取消修改</NButton>
          </template>
          <template v-else>
            <NCheckbox
              :checked="saveSource"
              :disabled="pending || applying"
              @update:checked="setSaveSource"
              >保存来源，便于检查更新</NCheckbox
            >
            <NButton
              type="primary"
              :loading="pending"
              :disabled="applying || !url.trim()"
              @click="readUrl()"
              >读取并预览</NButton
            >
          </template>
        </div>
        <div v-if="backup" class="app-panel rounded-6px border p-12px">
          <div>
            完整备份：{{ backup.items.length }} 条选择器，{{
              backup.sources.length
            }}
            个来源。
          </div>
          <div class="mt-8px">
            恢复将替换当前全部选择器、置顶、使用记录和来源。建议先导出当前完整备份。
          </div>
          <NPopconfirm @positiveClick="confirmImport">
            <template #trigger
              ><NButton class="mt-8px" type="warning" :loading="applying"
                >恢复完整备份</NButton
              ></template
            >
            确认用备份替换当前选择器库？
          </NPopconfirm>
        </div>
        <div v-if="plan" class="app-panel rounded-6px border p-12px">
          <div class="font-600">
            {{ plan.source?.name || '一次性导入' }} · 导入预览
          </div>
          <div class="my-8px">{{ summary }}</div>
          <NScrollbar class="max-h-320px">
            <div
              v-for="row in plan.rows"
              :key="row.key"
              class="mb-8px rounded border p-8px"
            >
              <div>
                {{ row.remote?.name || row.local?.name || row.key }} ·
                {{ labels[row.status] }}
              </div>
              <template v-if="row.status == 'updated'">
                <div class="mt-6px break-all text-12px">
                  本地：{{ row.local?.name }} · {{ row.local?.description }} ·
                  {{ row.local?.tags.join('、')
                  }}<SelectorText :source="row.local?.selector || ''" />
                </div>
                <div class="break-all text-12px">
                  本地范围：{{ row.local?.appId || '全局' }}
                  {{ row.local?.activityId }}
                </div>
                <div class="mt-6px break-all text-12px">
                  远端：{{ row.remote?.name }} · {{ row.remote?.description }} ·
                  {{ row.remote?.tags.join('、')
                  }}<SelectorText :source="row.remote?.selector || ''" />
                </div>
                <div class="break-all text-12px">
                  远端范围：{{ row.remote?.appId || '全局' }}
                  {{ row.remote?.activityId }}
                </div>
              </template>
              <div
                v-else-if="row.status == 'added' && row.remote"
                class="mt-6px break-all text-12px"
              >
                <div>
                  {{ row.remote.description }} {{ row.remote.tags.join('、') }}
                </div>
                <div>
                  适用范围：{{ row.remote.appId || '全局' }}
                  {{ row.remote.activityId }}
                </div>
                <SelectorText :source="row.remote.selector" />
              </div>
            </div>
          </NScrollbar>
          <NButton
            class="mt-12px"
            type="primary"
            :loading="applying"
            :disabled="pending"
            @click="confirmImport"
            >确认导入</NButton
          >
        </div>
        <div class="font-600">已保存的来源</div>
        <NEmpty v-if="!selectorLibrary.sources.length" description="暂无来源" />
        <div
          v-for="source in selectorLibrary.sources"
          :key="source.id"
          class="app-panel rounded-6px border p-12px"
        >
          <div class="font-600">{{ source.name }}</div>
          <div class="break-all text-12px">{{ source.url }}</div>
          <div class="text-12px">
            上次更新：{{
              source.checkedAt
                ? new Date(source.checkedAt).toLocaleString()
                : '尚未更新'
            }}
          </div>
          <div v-if="errors[source.id]" class="text-red-500">
            {{ errors[source.id] }}
          </div>
          <div class="mt-8px flex flex-wrap gap-8px">
            <NButton
              size="small"
              :disabled="pending || applying"
              @click="readUrl(source)"
              >检查更新</NButton
            >
            <NButton
              size="small"
              :disabled="pending || applying"
              @click="editSource(source)"
              >修改名称 / 地址</NButton
            >
            <NPopconfirm @positiveClick="removeSource(source.id)">
              <template #trigger
                ><NButton size="small" :disabled="pending || applying"
                  >移除来源</NButton
                ></template
              >
              移除来源并删除该来源的全部选择器？
            </NPopconfirm>
          </div>
        </div>
      </div>
    </NScrollbar>
  </NModal>
</template>
