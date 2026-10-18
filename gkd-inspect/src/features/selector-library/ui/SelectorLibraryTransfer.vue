<script setup lang="ts">
import {
  NButton,
  NCheckbox,
  NEmpty,
  NInput,
  NModal,
  NPopconfirm,
  NScrollbar,
} from 'naive-ui';
import { computed, onBeforeUnmount, shallowRef } from 'vue';

import {
  useLatestTask,
  useSingleTask,
  useKeyedTask,
  type TaskContext,
} from '@/shared/lib/latest_task';
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
const fileInput = shallowRef<HTMLInputElement>();
const url = shallowRef('');
const sourceName = shallowRef('');
const saveSource = shallowRef(true);
const editingSourceId = shallowRef<string>();
const plan = shallowRef<SelectorImportPlan>();
const backup = shallowRef<SelectorLibraryState>();
const backupFingerprint = shallowRef('');
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
  message.error(error instanceof Error ? error.message : String(error));
};
const resetPreview = () => {
  loadedUrl = undefined;
  plan.value = undefined;
  backup.value = undefined;
};
const makePreview = (data: NonNullable<typeof loadedUrl>) =>
  selectorLibraryActions.previewImport(
    data.value,
    saveSource.value
      ? {
          ...data.source,
          name: sourceName.value.trim() || new URL(data.source.url).hostname,
        }
      : undefined,
  );
const previewTask = useLatestTask(
  async (
    { commit },
    input:
      | { file: File }
      | { address: string; signal: AbortSignal }
      | { data: NonNullable<typeof loadedUrl> },
  ) => {
    if ('file' in input) {
      const value = JSON.parse(await input.file.text());
      const nextBackup =
        value?.kind == 'gkd-selector-library-backup'
          ? parseLibraryBackup(value)
          : undefined;
      const nextPlan = nextBackup
        ? undefined
        : selectorLibraryActions.previewImport(value);
      const fingerprint = libraryFingerprint(getState());
      commit(() => {
        loadedUrl = undefined;
        backup.value = nextBackup;
        plan.value = nextPlan;
        backupFingerprint.value = fingerprint;
      });
      return;
    }
    let data: NonNullable<typeof loadedUrl>;
    if ('data' in input) data = input.data;
    else {
      const address = normalizeSourceUrl(input.address);
      if (
        saveSource.value &&
        selectorLibrary.sources.some((source) => source.url == address)
      )
        throw new Error('该来源已保存，请使用来源列表中的“检查更新”');
      const source: SelectorSource = {
        id: crypto.randomUUID(),
        name: sourceName.value.trim() || new URL(address).hostname,
        url: address,
        checkedAt: 0,
        entries: [],
      };
      data = {
        value: await fetchSelectorLibrary(address, input.signal),
        source,
      };
    }
    const next = makePreview(data);
    commit(() => {
      loadedUrl = data;
      plan.value = next;
      backup.value = undefined;
    });
  },
);
const refreshTask = useKeyedTask(
  async (_context, _id: string, source: SelectorSource) => {
    try {
      const value = await fetchSelectorLibrary(source.url);
      const changed = await selectorLibraryActions.refreshSource(source, value);
      if (changed) message.success('更新成功');
      else message.info('没有更新');
    } catch (error) {
      throw new Error(
        '更新失败：' + (error instanceof Error ? error.message : String(error)),
        { cause: error },
      );
    }
  },
);
const writeTask = useSingleTask(
  (context, operation: (context: TaskContext) => Promise<void>) =>
    operation(context),
);
const pending = previewTask.loading;
const applying = computed(
  () =>
    writeTask.loading.value ||
    Object.keys(refreshTask.loading.value).length > 0,
);
const errors = computed(() =>
  Object.fromEntries(
    Object.entries(refreshTask.errors.value).map(([id, error]) => [
      id,
      error?.message,
    ]),
  ),
);
const errorText = computed(
  () =>
    previewTask.error.value?.message || writeTask.error.value?.message || '',
);
const notifyResult = (result: { status: string; error?: Error }) => {
  if (result.status === 'error') reportError(result.error);
};
const cancelPreview = () => {
  controller?.abort();
  previewTask.cancel();
};
const setVisible = (value: boolean) => {
  if (applying.value) return;
  cancelPreview();
  writeTask.cancel();
  show.value = value;
  resetPreview();
};
const openImport = () => setVisible(true);
const setUrl = (value: string) => {
  cancelPreview();
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
const setSaveSource = (value: boolean) => {
  saveSource.value = value;
  if (loadedUrl) void previewTask.run({ data: loadedUrl }).then(notifyResult);
};
const readUrl = async (existing?: SelectorSource) => {
  if (writeTask.loading.value) return;
  if (existing) {
    notifyResult(await refreshTask.run(existing.id, existing));
    return;
  }
  cancelPreview();
  controller = new AbortController();
  notifyResult(
    await previewTask.run({ address: url.value, signal: controller.signal }),
  );
};
const openFile = () => fileInput.value?.click();
const readFile = async () => {
  const file = fileInput.value?.files?.[0];
  if (!file || applying.value) return;
  fileInput.value!.value = '';
  cancelPreview();
  notifyResult(await previewTask.run({ file }));
};
const confirmImport = async () => {
  if (applying.value || pending.value) return;
  const currentBackup = backup.value;
  const currentPlan = plan.value;
  const fingerprint = backupFingerprint.value;
  const summary = appliedSummary.value;
  notifyResult(
    await writeTask.run(async ({ commit }) => {
      if (currentBackup)
        await selectorLibraryActions.restoreBackup(currentBackup, fingerprint);
      else if (currentPlan)
        await selectorLibraryActions.confirmImport(currentPlan);
      else return;
      message.success(
        currentBackup ? '完整备份已恢复' : '导入完成：' + summary,
      );
      commit(() => {
        resetPreview();
      });
    }),
  );
};
const editSource = (source: SelectorSource) => {
  cancelPreview();
  resetPreview();
  editingSourceId.value = source.id;
  url.value = source.url;
  sourceName.value = source.name;
};
const cancelEdit = () => {
  cancelPreview();
  editingSourceId.value = undefined;
  url.value = '';
  sourceName.value = '';
  resetPreview();
};
const saveSourceChanges = async () => {
  const id = editingSourceId.value;
  if (!id || applying.value) return;
  const name = sourceName.value,
    address = url.value;
  notifyResult(
    await writeTask.run(async ({ commit }) => {
      await selectorLibraryActions.updateSource(id, name, address);
      message.success('来源已保存');
      commit(() => {
        if (
          editingSourceId.value === id &&
          url.value === address &&
          sourceName.value === name
        )
          cancelEdit();
      });
    }),
  );
};
const removeSource = async (id: string) => {
  if (applying.value || pending.value) return;
  notifyResult(
    await writeTask.run(async ({ commit }) => {
      await selectorLibraryActions.removeSource(id);
      message.success('已移除来源及其选择器');
      commit(() => {
        if (editingSourceId.value === id) cancelEdit();
        else resetPreview();
      });
    }),
  );
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
onBeforeUnmount(cancelPreview);
</script>

<template>
  <div class="flex flex-wrap gap-[8px]">
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
    class="w-[880px] max-w-[calc(100vw-32px)]"
    :maskClosable="false"
    @update:show="setVisible"
  >
    <NScrollbar class="max-h-[75vh]">
      <div class="flex flex-col gap-[12px] pr-[8px]">
        <div v-if="errorText" role="alert" class="text-red-500">
          {{ errorText }}
        </div>
        <div class="flex flex-wrap gap-[8px]">
          <NButton :disabled="pending || applying" @click="openFile"
            >从本地文件导入</NButton
          >
          <input
            ref="fileInput"
            class="hidden"
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
        <div class="flex flex-wrap items-center gap-[8px]">
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
        <div
          v-if="backup"
          class="border-(--app-border)! bg-(--app-panel)! text-(--app-text) rounded-[6px] border p-[12px]"
        >
          <div>
            完整备份：{{ backup.items.length }} 条选择器，{{
              backup.sources.length
            }}
            个来源。
          </div>
          <div class="mt-[8px]">
            恢复将替换当前全部选择器、置顶、使用记录和来源。建议先导出当前完整备份。
          </div>
          <NPopconfirm @positiveClick="confirmImport">
            <template #trigger
              ><NButton class="mt-[8px]" type="warning" :loading="applying"
                >恢复完整备份</NButton
              ></template
            >
            确认用备份替换当前选择器库？
          </NPopconfirm>
        </div>
        <div
          v-if="plan"
          class="border-(--app-border)! bg-(--app-panel)! text-(--app-text) rounded-[6px] border p-[12px]"
        >
          <div class="font-semibold">
            {{ plan.source?.name || '一次性导入' }} · 导入预览
          </div>
          <div class="my-[8px]">{{ summary }}</div>
          <NScrollbar class="max-h-[320px]">
            <div
              v-for="row in plan.rows"
              :key="row.key"
              class="mb-[8px] rounded-sm border p-[8px]"
            >
              <div>
                {{ row.remote?.name || row.local?.name || row.key }} ·
                {{ labels[row.status] }}
              </div>
              <template v-if="row.status == 'updated'">
                <div class="mt-[6px] break-all text-[12px]">
                  本地：{{ row.local?.name }} · {{ row.local?.description }} ·
                  {{ row.local?.tags.join('、')
                  }}<SelectorText :source="row.local?.selector || ''" />
                </div>
                <div class="break-all text-[12px]">
                  本地范围：{{ row.local?.appId || '全局' }}
                  {{ row.local?.activityId }}
                </div>
                <div class="mt-[6px] break-all text-[12px]">
                  远端：{{ row.remote?.name }} · {{ row.remote?.description }} ·
                  {{ row.remote?.tags.join('、')
                  }}<SelectorText :source="row.remote?.selector || ''" />
                </div>
                <div class="break-all text-[12px]">
                  远端范围：{{ row.remote?.appId || '全局' }}
                  {{ row.remote?.activityId }}
                </div>
              </template>
              <div
                v-else-if="row.status == 'added' && row.remote"
                class="mt-[6px] break-all text-[12px]"
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
            class="mt-[12px]"
            type="primary"
            :loading="applying"
            :disabled="pending"
            @click="confirmImport"
            >确认导入</NButton
          >
        </div>
        <div class="font-semibold">已保存的来源</div>
        <NEmpty v-if="!selectorLibrary.sources.length" description="暂无来源" />
        <div
          v-for="source in selectorLibrary.sources"
          :key="source.id"
          class="border-(--app-border)! bg-(--app-panel)! text-(--app-text) rounded-[6px] border p-[12px]"
        >
          <div class="font-semibold">{{ source.name }}</div>
          <div class="break-all text-[12px]">{{ source.url }}</div>
          <div class="text-[12px]">
            上次更新：{{
              source.checkedAt
                ? new Date(source.checkedAt).toLocaleString()
                : '尚未更新'
            }}
          </div>
          <div v-if="errors[source.id]" class="text-red-500">
            {{ errors[source.id] }}
          </div>
          <div class="mt-[8px] flex flex-wrap gap-[8px]">
            <NButton
              size="small"
              :loading="refreshTask.loading.value[source.id]"
              :disabled="pending || writeTask.loading.value"
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
