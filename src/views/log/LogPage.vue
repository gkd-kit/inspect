<script lang="tsx" setup>
import type { RawSubscription } from '@gkd-kit/api';
import type { TreeOption } from 'naive-ui';
import { message } from '@/utils/discrete';
import { enhanceFetch } from '@/utils/fetch';
import {
  getLogPathSource,
  getLogQuerySource,
  getLogRoute,
  type LogSource,
} from '@/utils/log_url';
import { getDragEventFiles } from '@/utils/others';
import AppsPreview from './AppsPreview.vue';
import { getAppsPreviewData, type AppsPreviewData } from './apps_preview';
import CrashPreview from './CrashPreview.vue';
import {
  CRASH_TREE_KEY,
  getCrashEntries,
  getUnsupportedCrashDetail,
  getUnreadableCrashDetail,
  isCrashJsonPath,
  isCrashPath,
  loadCrashSummaries,
  parseCrashDetail,
  type CrashDetail,
  type CrashSummary,
} from './crash_preview';
import {
  getLogDirectoryEntries,
  getLogFileSummaries,
  getSubscriptionDirectoryEntries,
  getUnsupportedSubscriptionDetail,
  getUnreadableSubscriptionDetail,
  isLogDirectoryPath,
  isSubscriptionDirectoryPath,
  isSubscriptionJsonPath,
  loadSubscriptionFileSummaries,
  LOG_TREE_KEY,
  parseSubscriptionFileDetail,
  SUBSCRIPTION_TREE_KEY,
  type LogFileSummary,
  type SubscriptionFileDetail,
  type SubscriptionFileSummary,
} from './directory_preview';
import { isJsonTreeTooLarge } from './json_preview';
import JsonPreview from './JsonPreview.vue';
import LogDirectoryPreview from './LogDirectoryPreview.vue';
import { readLimitedResponse } from './response';
import SubscriptionPreview from './SubscriptionPreview.vue';
import SubscriptionDirectoryPreview from './SubscriptionDirectoryPreview.vue';
import SqlitePreview from './SqlitePreview.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import {
  decodeLogText,
  formatBytes,
  getLogAppNames,
  getLogSubscriptionNames,
  getDatabaseFiles,
  getDefaultLogEntry,
  isRawSubscription,
  loadLogArchive,
  MAX_JSON_SIZE,
  MAX_ZIP_SIZE,
  readEntryBytes,
  shouldUseSubscriptionPreview,
  type LogArchive,
  type LogEntry,
} from './log';
import {
  getLogArchiveCache,
  removeLogArchiveCache,
  setLogArchiveCache,
} from './log_cache';

type PreviewKind =
  | `none`
  | `text`
  | `json`
  | `apps`
  | `crash`
  | `log-directory`
  | `subscription-directory`
  | `subscription`
  | `invalid-json`
  | `database`
  | `unsupported`;

const route = useRoute();
const router = useRouter();
const archive = shallowRef<LogArchive>();
const selectedPath = shallowRef(``);
const archiveLoading = shallowRef(false);
const previewLoading = shallowRef(false);
const errorText = shallowRef(``);
const inputUrl = shallowRef(``);
const previewKind = shallowRef<PreviewKind>(`none`);
const previewText = shallowRef(``);
const jsonValue = shallowRef<unknown>();
const appsData = shallowRef<AppsPreviewData>();
const crashItems = shallowRef<CrashSummary[]>([]);
const crashDetail = shallowRef<CrashDetail>();
const crashDetailLoading = shallowRef(false);
const logItems = shallowRef<LogFileSummary[]>([]);
const logDetailPath = shallowRef(``);
const logDetailText = shallowRef<string>();
const logDetailError = shallowRef(``);
const logDetailLoading = shallowRef(false);
const subscriptionItems = shallowRef<SubscriptionFileSummary[]>([]);
const subscriptionDetail = shallowRef<SubscriptionFileDetail>();
const subscriptionDetailStructured = shallowRef(false);
const subscriptionDetailLoading = shallowRef(false);
const jsonError = shallowRef(``);
const databaseData = shallowRef<Uint8Array>();
const walData = shallowRef<Uint8Array>();
const appNames = shallowRef<Record<string, string>>({});
const subscriptionNames = shallowRef<Record<string, string>>({});
const localFileInput = shallowRef<HTMLInputElement>();
const filePanelCollapsed = shallowRef(false);
let loadSequence = 0;
let previewSequence = 0;
let crashDetailSequence = 0;
let crashSummaryTask: Promise<CrashSummary[]> | undefined;
let logDetailSequence = 0;
let subscriptionDetailSequence = 0;
let subscriptionSummaryTask: Promise<SubscriptionFileSummary[]> | undefined;
let activeFetchController: AbortController | undefined;

const selectedEntry = computed(() =>
  archive.value?.entryMap.get(selectedPath.value),
);

const clearCrashDetail = () => {
  crashDetailSequence++;
  crashDetail.value = undefined;
  crashDetailLoading.value = false;
};

const resetCrashData = () => {
  crashSummaryTask = undefined;
  crashItems.value = [];
  clearCrashDetail();
};

const clearLogDetail = () => {
  logDetailSequence++;
  logDetailPath.value = ``;
  logDetailText.value = undefined;
  logDetailError.value = ``;
  logDetailLoading.value = false;
};

const clearSubscriptionDetail = () => {
  subscriptionDetailSequence++;
  subscriptionDetail.value = undefined;
  subscriptionDetailStructured.value = false;
  subscriptionDetailLoading.value = false;
};

const resetDirectoryData = () => {
  logItems.value = [];
  subscriptionItems.value = [];
  subscriptionSummaryTask = undefined;
  clearLogDetail();
  clearSubscriptionDetail();
};

const clearPreview = () => {
  previewLoading.value = false;
  previewKind.value = `none`;
  previewText.value = ``;
  jsonValue.value = undefined;
  appsData.value = undefined;
  jsonError.value = ``;
  databaseData.value = undefined;
  walData.value = undefined;
  appNames.value = {};
  subscriptionNames.value = {};
  clearCrashDetail();
  clearLogDetail();
  clearSubscriptionDetail();
};

const showEntry = async (entry: LogEntry | undefined) => {
  const sequence = ++previewSequence;
  errorText.value = ``;
  clearPreview();
  if (!entry) return;
  selectedPath.value = entry.path;
  previewLoading.value = true;
  try {
    if (entry.kind == `database`) {
      if (!archive.value) return;
      const [files, resolvedAppNames, resolvedSubscriptionNames] =
        await Promise.all([
          getDatabaseFiles(archive.value, entry),
          getLogAppNames(archive.value),
          getLogSubscriptionNames(archive.value),
        ]);
      if (sequence != previewSequence) return;
      databaseData.value = markRaw(files.database);
      walData.value = files.wal ? markRaw(files.wal) : undefined;
      appNames.value = markRaw(resolvedAppNames);
      subscriptionNames.value = markRaw(resolvedSubscriptionNames);
      previewKind.value = `database`;
      return;
    }
    if (entry.kind == `text`) {
      const bytes = await readEntryBytes(entry);
      if (sequence != previewSequence) return;
      previewText.value = decodeLogText(bytes);
      previewKind.value = `text`;
      return;
    }
    if (entry.kind == `json`) {
      const bytes = await readEntryBytes(entry, MAX_JSON_SIZE);
      const raw = decodeLogText(bytes);
      if (sequence != previewSequence) return;
      previewText.value = raw;
      try {
        const value: unknown = JSON.parse(raw);
        jsonValue.value = value;
        const structureTooLarge = isJsonTreeTooLarge(value);
        const isAppsFile =
          entry.path.toLowerCase().split(`/`).at(-1) == `apps.json`;
        const resolvedAppsData =
          isAppsFile && !structureTooLarge
            ? getAppsPreviewData(value)
            : undefined;
        if (resolvedAppsData) {
          appsData.value = markRaw(resolvedAppsData);
          previewKind.value = `apps`;
        } else if (
          !structureTooLarge &&
          shouldUseSubscriptionPreview(entry, value)
        ) {
          previewKind.value = `subscription`;
        } else {
          previewKind.value = `json`;
        }
      } catch (error) {
        jsonError.value =
          error instanceof Error ? error.message : String(error);
        previewKind.value = `invalid-json`;
      }
      return;
    }
    previewKind.value = `unsupported`;
  } catch (error) {
    if (sequence != previewSequence) return;
    errorText.value = error instanceof Error ? error.message : String(error);
    previewKind.value = `unsupported`;
  } finally {
    if (sequence == previewSequence) previewLoading.value = false;
  }
};

const showCrashPreview = async () => {
  const currentArchive = archive.value;
  if (!currentArchive) return;
  const entries = getCrashEntries(currentArchive.entries);
  if (entries.length == 0) return;
  const sequence = ++previewSequence;
  errorText.value = ``;
  clearPreview();
  selectedPath.value = CRASH_TREE_KEY;
  previewKind.value = `crash`;
  if (crashItems.value.length == entries.length) return;
  previewLoading.value = true;
  try {
    crashSummaryTask ||= loadCrashSummaries(entries, async (entry) => {
      return decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
    });
    const items = await crashSummaryTask;
    if (
      sequence != previewSequence ||
      currentArchive != archive.value ||
      selectedPath.value != CRASH_TREE_KEY
    ) {
      return;
    }
    crashItems.value = markRaw(items);
  } catch (error) {
    if (sequence != previewSequence) return;
    errorText.value = error instanceof Error ? error.message : String(error);
    previewKind.value = `unsupported`;
  } finally {
    if (sequence == previewSequence) previewLoading.value = false;
  }
};

const loadCrashDetail = async (path: string) => {
  const currentArchive = archive.value;
  const entry = currentArchive?.entryMap.get(path);
  if (!currentArchive || !entry || !isCrashPath(entry.path)) return;
  const sequence = ++crashDetailSequence;
  crashDetail.value = undefined;
  crashDetailLoading.value = true;
  if (!isCrashJsonPath(entry.path)) {
    crashDetail.value = markRaw(getUnsupportedCrashDetail(entry.path));
    crashDetailLoading.value = false;
    return;
  }
  try {
    const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
    if (
      sequence != crashDetailSequence ||
      currentArchive != archive.value ||
      previewKind.value != `crash`
    ) {
      return;
    }
    crashDetail.value = markRaw(parseCrashDetail(raw, entry.path));
  } catch (error) {
    if (sequence != crashDetailSequence) return;
    crashDetail.value = markRaw(getUnreadableCrashDetail(entry.path, error));
  } finally {
    if (sequence == crashDetailSequence) crashDetailLoading.value = false;
  }
};

const showLogDirectoryPreview = () => {
  const currentArchive = archive.value;
  if (!currentArchive) return;
  const entries = getLogDirectoryEntries(currentArchive.entries);
  if (entries.length == 0) return;
  previewSequence++;
  errorText.value = ``;
  clearPreview();
  selectedPath.value = LOG_TREE_KEY;
  logItems.value = markRaw(getLogFileSummaries(entries));
  previewKind.value = `log-directory`;
};

const loadLogFileDetail = async (path: string) => {
  const currentArchive = archive.value;
  const entry = currentArchive?.entryMap.get(path);
  if (!currentArchive || !entry || !isLogDirectoryPath(entry.path)) return;
  const sequence = ++logDetailSequence;
  logDetailPath.value = entry.path;
  logDetailText.value = undefined;
  logDetailError.value = ``;
  logDetailLoading.value = true;
  try {
    const text = decodeLogText(await readEntryBytes(entry));
    if (
      sequence != logDetailSequence ||
      currentArchive != archive.value ||
      previewKind.value != `log-directory`
    ) {
      return;
    }
    logDetailText.value = text;
  } catch (error) {
    if (sequence != logDetailSequence) return;
    logDetailError.value =
      error instanceof Error ? error.message : String(error);
  } finally {
    if (sequence == logDetailSequence) logDetailLoading.value = false;
  }
};

const showSubscriptionDirectoryPreview = async () => {
  const currentArchive = archive.value;
  if (!currentArchive) return;
  const entries = getSubscriptionDirectoryEntries(currentArchive.entries);
  if (entries.length == 0) return;
  const sequence = ++previewSequence;
  errorText.value = ``;
  clearPreview();
  selectedPath.value = SUBSCRIPTION_TREE_KEY;
  previewKind.value = `subscription-directory`;
  if (subscriptionItems.value.length == entries.length) return;
  previewLoading.value = true;
  try {
    subscriptionSummaryTask ||= loadSubscriptionFileSummaries(
      entries,
      async (entry) => {
        return decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
      },
    );
    const items = await subscriptionSummaryTask;
    if (
      sequence != previewSequence ||
      currentArchive != archive.value ||
      selectedPath.value != SUBSCRIPTION_TREE_KEY
    ) {
      return;
    }
    subscriptionItems.value = markRaw(items);
  } catch (error) {
    if (sequence != previewSequence) return;
    errorText.value = error instanceof Error ? error.message : String(error);
    previewKind.value = `unsupported`;
  } finally {
    if (sequence == previewSequence) previewLoading.value = false;
  }
};

const loadSubscriptionDetail = async (path: string) => {
  const currentArchive = archive.value;
  const entry = currentArchive?.entryMap.get(path);
  if (!currentArchive || !entry || !isSubscriptionDirectoryPath(entry.path)) {
    return;
  }
  const sequence = ++subscriptionDetailSequence;
  subscriptionDetail.value = undefined;
  subscriptionDetailStructured.value = false;
  subscriptionDetailLoading.value = true;
  if (!isSubscriptionJsonPath(entry.path)) {
    subscriptionDetail.value = markRaw(
      getUnsupportedSubscriptionDetail(entry.path),
    );
    subscriptionDetailLoading.value = false;
    return;
  }
  try {
    const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
    if (
      sequence != subscriptionDetailSequence ||
      currentArchive != archive.value ||
      previewKind.value != `subscription-directory`
    ) {
      return;
    }
    const detail = parseSubscriptionFileDetail(raw, entry.path);
    subscriptionDetail.value = markRaw(detail);
    subscriptionDetailStructured.value =
      detail.parsed && isRawSubscription(detail.value);
  } catch (error) {
    if (sequence != subscriptionDetailSequence) return;
    subscriptionDetail.value = markRaw(
      getUnreadableSubscriptionDetail(entry.path, error),
    );
  } finally {
    if (sequence == subscriptionDetailSequence) {
      subscriptionDetailLoading.value = false;
    }
  }
};

const loadArchive = async (
  data: Blob | ArrayBuffer | Uint8Array,
  name: string,
  sequence = ++loadSequence,
) => {
  previewSequence++;
  resetCrashData();
  resetDirectoryData();
  archiveLoading.value = true;
  errorText.value = ``;
  clearPreview();
  archive.value = undefined;
  selectedPath.value = ``;
  try {
    const result = await loadLogArchive(data, name || `log.zip`);
    if (sequence != loadSequence) return;
    archive.value = result;
    const initialEntry = getDefaultLogEntry(result);
    if (initialEntry && isLogDirectoryPath(initialEntry.path)) {
      showLogDirectoryPreview();
    } else if (initialEntry && isCrashPath(initialEntry.path)) {
      await showCrashPreview();
    } else if (initialEntry && isSubscriptionDirectoryPath(initialEntry.path)) {
      await showSubscriptionDirectoryPreview();
    } else if (initialEntry) {
      await showEntry(initialEntry);
    } else if (getLogDirectoryEntries(result.entries).length) {
      showLogDirectoryPreview();
    } else if (getCrashEntries(result.entries).length) {
      await showCrashPreview();
    } else if (getSubscriptionDirectoryEntries(result.entries).length) {
      await showSubscriptionDirectoryPreview();
    }
    return sequence == loadSequence;
  } catch (error) {
    if (sequence != loadSequence) return;
    errorText.value = error instanceof Error ? error.message : String(error);
    return false;
  } finally {
    if (sequence == loadSequence) archiveLoading.value = false;
  }
};

const getResponseName = (response: Response, source: LogSource) => {
  const disposition = response.headers.get(`content-disposition`) || ``;
  const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = utf8Name || plainName;
  if (candidate) {
    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
  }
  if (source.name?.toLowerCase().endsWith(`.zip`)) return source.name;
  try {
    const finalName = new URL(response.url || source.url).pathname
      .split(`/`)
      .filter(Boolean)
      .at(-1);
    if (finalName) return decodeURIComponent(finalName);
  } catch {}
  return `log.zip`;
};

const fetchArchive = async (
  source: LogSource,
  sequence: number,
  controller: AbortController,
) => {
  const cached = await getLogArchiveCache(source.url);
  if (sequence != loadSequence) return;
  if (cached) {
    const loaded = await loadArchive(cached.data, cached.name, sequence);
    if (loaded) return;
    if (sequence != loadSequence) return;
    await removeLogArchiveCache(source.url);
    archiveLoading.value = true;
    errorText.value = ``;
  }

  let downloadTooLarge = false;
  let response: Response;
  try {
    response = await enhanceFetch(
      source.url,
      { credentials: `omit`, signal: controller.signal },
      (details) => ({
        ...details,
        anonymous: true,
        onprogress(progress) {
          details.onprogress?.call(progress, progress);
          if (progress.loaded > MAX_ZIP_SIZE) {
            downloadTooLarge = true;
            controller.abort();
          }
        },
      }),
    );
  } catch (error) {
    if (downloadTooLarge) {
      throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`, {
        cause: error,
      });
    }
    throw error;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get(`content-length`) || 0);
  if (declaredSize > MAX_ZIP_SIZE) {
    throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`);
  }
  let data: ArrayBuffer;
  try {
    data = await readLimitedResponse(response, MAX_ZIP_SIZE);
  } catch (error) {
    if (error instanceof Error && error.message == `响应内容超过大小限制`) {
      throw new Error(`ZIP 文件不能超过 ${formatBytes(MAX_ZIP_SIZE)}`, {
        cause: error,
      });
    }
    throw error;
  }
  if (sequence != loadSequence) return;
  const name = getResponseName(response, source);
  const loaded = await loadArchive(data, name, sequence);
  if (loaded) void setLogArchiveCache(source.url, name, data);
};

const getRouteSource = () => {
  if (route.path == `/log`) return getLogQuerySource(route.query.url);
  return getLogPathSource(route.params.pathMatch);
};

const loadFromRoute = async () => {
  activeFetchController?.abort();
  const controller = new AbortController();
  activeFetchController = controller;
  const source = getRouteSource();
  const sequence = ++loadSequence;
  previewSequence++;
  resetCrashData();
  resetDirectoryData();
  archive.value = undefined;
  selectedPath.value = ``;
  clearPreview();
  errorText.value = ``;
  if (!source) {
    archiveLoading.value = false;
    inputUrl.value = ``;
    return;
  }
  inputUrl.value = source.url;
  archiveLoading.value = true;
  try {
    await fetchArchive(source, sequence, controller);
  } catch (error) {
    if (sequence != loadSequence) return;
    errorText.value = error instanceof Error ? error.message : String(error);
    archiveLoading.value = false;
  }
};

watch(() => route.fullPath, loadFromRoute, { immediate: true });

const submitUrl = async () => {
  const target = getLogRoute(inputUrl.value);
  if (!target) {
    message.warning(`请输入有效的 HTTP/HTTPS 链接`);
    return;
  }
  const fullPath = router.resolve(target).fullPath;
  if (fullPath == route.fullPath) await loadFromRoute();
  else await router.push(target);
};

const importLocalFile = async (files: File[]) => {
  const file = files.find((item) => item.name.toLowerCase().endsWith(`.zip`));
  if (!file) return;
  activeFetchController?.abort();
  activeFetchController = undefined;
  loadSequence++;
  if (route.fullPath != `/log`) await router.replace(`/log`);
  inputUrl.value = ``;
  await loadArchive(file, file.name);
};

const openLocalFile = () => localFileInput.value?.click();
const handleLocalFile = () => {
  const input = localFileInput.value;
  if (!input) return;
  const files = [...(input.files || [])];
  input.value = ``;
  void importLocalFile(files);
};

useEventListener(document.body, `dragover`, (event) => event.preventDefault());
useEventListener(document.body, `drop`, (event) => {
  event.preventDefault();
  const files = getDragEventFiles(event);
  if (!files.some((file) => file.name.toLowerCase().endsWith(`.zip`))) {
    message.warning(`请拖入 ZIP 文件`);
    return;
  }
  void importLocalFile(files);
});

type LogTreeOption = TreeOption & {
  path?: string;
  isFile?: boolean;
};
const treeData = computed<LogTreeOption[]>(() => {
  const roots: LogTreeOption[] = [];
  const nodes = new Map<string, LogTreeOption>();
  const entries = archive.value?.entries || [];
  const crashEntries = getCrashEntries(entries);
  const logEntries = getLogDirectoryEntries(entries);
  const subscriptionEntries = getSubscriptionDirectoryEntries(entries);
  for (const entry of entries) {
    if (
      isCrashPath(entry.path) ||
      isLogDirectoryPath(entry.path) ||
      isSubscriptionDirectoryPath(entry.path)
    ) {
      continue;
    }
    const parts = entry.path.split(`/`).filter(Boolean);
    let parentChildren = roots;
    let currentPath = ``;
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = nodes.get(currentPath);
      if (!node) {
        const isFile = index == parts.length - 1;
        node = {
          key: currentPath,
          label: part,
          path: isFile ? entry.path : undefined,
          isFile,
          children: isFile ? undefined : [],
        };
        nodes.set(currentPath, node);
        parentChildren.push(node);
      }
      parentChildren = (node.children || []) as LogTreeOption[];
    });
  }
  if (crashEntries.length) {
    roots.push({
      key: CRASH_TREE_KEY,
      label: `crash (${crashEntries.length})`,
      isFile: true,
    });
  }
  if (logEntries.length) {
    roots.push({
      key: LOG_TREE_KEY,
      label: `log (${logEntries.length})`,
      isFile: true,
    });
  }
  if (subscriptionEntries.length) {
    roots.push({
      key: SUBSCRIPTION_TREE_KEY,
      label: `subscription (${subscriptionEntries.length})`,
      isFile: true,
    });
  }
  roots.sort((a, b) =>
    String(a.label || ``).localeCompare(String(b.label || ``), `zh-CN`),
  );
  return roots;
});

const updateSelectedKeys = (keys: Array<string | number>) => {
  const path = String(keys[0] || ``);
  if (path == CRASH_TREE_KEY) {
    void showCrashPreview();
    return;
  }
  if (path == LOG_TREE_KEY) {
    showLogDirectoryPreview();
    return;
  }
  if (path == SUBSCRIPTION_TREE_KEY) {
    void showSubscriptionDirectoryPreview();
    return;
  }
  const entry = archive.value?.entryMap.get(path);
  if (entry) void showEntry(entry);
};
</script>

<template>
  <div
    name="log-page"
    page-size
    class="box-border flex min-h-700px min-w-1200px flex-col gap-10px bg-[#f8fafc] p-10px"
  >
    <div name="log-toolbar" class="h-42px flex items-center gap-10px">
      <RouterLink to="/" flex items-center>
        <NButton quaternary>返回首页</NButton>
      </RouterLink>
      <div name="log-title" class="flex-none text-18px font-600">
        日志包查看器
      </div>
      <NInputGroup class="ml-auto min-w-420px max-w-720px">
        <NInput
          v-model:value="inputUrl"
          clearable
          placeholder="粘贴 GitHub、f.gkd.li 或其他 ZIP 链接"
          @keyup.enter="submitUrl"
        />
        <NButton type="primary" :loading="archiveLoading" @click="submitUrl">
          加载链接
        </NButton>
      </NInputGroup>
      <NButton :disabled="archiveLoading" @click="openLocalFile">
        选择本地 ZIP
      </NButton>
      <input
        ref="localFileInput"
        hidden
        type="file"
        accept=".zip,application/zip"
        @change="handleLocalFile"
      />
    </div>

    <NAlert v-if="errorText" type="error" closable @close="errorText = ``">
      {{ errorText }}
    </NAlert>

    <div
      v-if="archive"
      name="log-workspace"
      class="flex min-h-0 flex-1 gap-10px"
    >
      <div
        name="log-file-panel"
        class="box-border flex min-h-0 flex-col rounded-6px border border-[#e2e8f0] bg-white transition-[width,min-width] duration-180 ease"
        :class="
          filePanelCollapsed ? 'w-44px min-w-44px' : 'w-300px min-w-300px'
        "
      >
        <div
          name="archive-meta"
          class="flex min-w-0 items-start gap-8px"
          :class="
            filePanelCollapsed
              ? 'justify-center border-b-0 p-8px'
              : 'border-b border-[#e5e7eb] p-12px'
          "
        >
          <div
            v-if="!filePanelCollapsed"
            name="archive-meta-content"
            class="min-w-0 flex-1"
          >
            <div
              name="archive-name"
              class="overflow-hidden text-ellipsis whitespace-nowrap font-600"
              :title="archive.name"
            >
              {{ archive.name }}
            </div>
            <div name="archive-stats" class="mt-3px text-12px text-[#64748b]">
              {{ archive.entries.length }} 个文件 ·
              {{ formatBytes(archive.uncompressedSize) }}
            </div>
          </div>
          <button
            type="button"
            class="inline-grid h-26px w-26px flex-none cursor-pointer place-items-center rounded-4px border-0 bg-transparent p-0 text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2563eb] focus-visible:outline-offset-1"
            :aria-expanded="!filePanelCollapsed"
            :aria-label="filePanelCollapsed ? '展开文件列表' : '收起文件列表'"
            :title="filePanelCollapsed ? '展开文件列表' : '收起文件列表'"
            @click="filePanelCollapsed = !filePanelCollapsed"
          >
            <SvgIcon
              name="arrow"
              class="h-17px w-17px transition-transform duration-180 ease"
              :class="filePanelCollapsed ? '-rotate-90' : 'rotate-90'"
            />
          </button>
        </div>
        <NTree
          v-if="!filePanelCollapsed"
          blockLine
          virtualScroll
          defaultExpandAll
          :data="treeData"
          :selectedKeys="selectedPath ? [selectedPath] : []"
          class="min-h-0 flex-1 p-8px"
          @update:selectedKeys="updateSelectedKeys"
        />
      </div>

      <div
        name="log-preview-panel"
        class="box-border flex min-h-0 min-w-0 flex-1 flex-col rounded-6px border border-[#e2e8f0] bg-white"
      >
        <div
          v-if="
            selectedEntry &&
            selectedEntry.kind != 'text' &&
            previewKind != 'invalid-json'
          "
          name="preview-header"
          class="box-border min-h-52px flex items-center gap-10px border-b border-[#e5e7eb] px-12px py-8px [&>:first-child]:flex-1"
        >
          <div min-w-0>
            <div
              name="preview-path"
              class="overflow-hidden text-ellipsis whitespace-nowrap font-600"
              :title="selectedEntry.path"
            >
              {{ selectedEntry.path }}
            </div>
            <div name="preview-size" class="mt-3px text-12px text-[#64748b]">
              {{ formatBytes(selectedEntry.size) }}
            </div>
          </div>
        </div>

        <div name="preview-body" class="min-h-0 flex-1 p-12px">
          <NSpin v-if="previewLoading" show class="h-full w-full" />
          <NEmpty
            v-else-if="previewKind == 'none'"
            description="该日志包没有可预览内容"
          />
          <div
            v-else-if="previewKind == 'text' || previewKind == 'invalid-json'"
            name="text-preview-wrapper"
            class="h-full min-h-0 flex flex-col gap-8px"
          >
            <NAlert
              v-if="previewKind == 'invalid-json'"
              type="warning"
              title="JSON 解析失败，以下为原始内容"
              class="flex-none"
            >
              {{ jsonError }}
            </NAlert>
            <TextViewer
              :value="previewText"
              search-placeholder="搜索当前文件"
              allow-wrap
              copyable
            >
              <template #toolbar-start>
                <div
                  v-if="selectedEntry"
                  name="text-preview-file-meta"
                  class="min-w-0 max-w-260px flex-[0_1_260px] text-left"
                >
                  <div
                    name="preview-path"
                    class="overflow-hidden text-ellipsis whitespace-nowrap font-600"
                    :title="selectedEntry.path"
                  >
                    {{ selectedEntry.path }}
                  </div>
                  <div
                    name="preview-size"
                    class="mt-3px text-12px text-[#64748b]"
                  >
                    {{ formatBytes(selectedEntry.size) }}
                  </div>
                </div>
              </template>
            </TextViewer>
          </div>
          <JsonPreview
            v-else-if="previewKind == 'json'"
            :key="selectedPath"
            :value="jsonValue"
            :raw="previewText"
          />
          <CrashPreview
            v-else-if="previewKind == 'crash'"
            :items="crashItems"
            :detail="crashDetail"
            :detailLoading="crashDetailLoading"
            @select="loadCrashDetail"
          />
          <LogDirectoryPreview
            v-else-if="previewKind == 'log-directory'"
            :items="logItems"
            :detailPath="logDetailPath"
            :detailText="logDetailText"
            :detailError="logDetailError"
            :detailLoading="logDetailLoading"
            @select="loadLogFileDetail"
          />
          <SubscriptionDirectoryPreview
            v-else-if="previewKind == 'subscription-directory'"
            :items="subscriptionItems"
            :detail="subscriptionDetail"
            :detailStructured="subscriptionDetailStructured"
            :detailLoading="subscriptionDetailLoading"
            @select="loadSubscriptionDetail"
          />
          <AppsPreview
            v-else-if="previewKind == 'apps' && appsData"
            :key="selectedPath"
            :data="appsData"
            :value="jsonValue"
            :raw="previewText"
          />
          <SubscriptionPreview
            v-else-if="
              previewKind == 'subscription' && isRawSubscription(jsonValue)
            "
            :key="selectedPath"
            :value="jsonValue as RawSubscription"
            :raw="previewText"
          />
          <SqlitePreview
            v-else-if="previewKind == 'database' && databaseData"
            :key="selectedPath"
            :database="databaseData"
            :wal="walData"
            :app-names="appNames"
            :subscription-names="subscriptionNames"
          />
          <NEmpty v-else description="该文件不支持预览" />
        </div>
      </div>
    </div>

    <div
      v-else
      name="log-empty-state"
      class="grid min-h-0 flex-1 place-items-center"
    >
      <NSpin :show="archiveLoading">
        <div
          name="drop-zone"
          class="box-border h-300px w-620px flex cursor-pointer flex-col items-center justify-center rounded-12px border-2 border-[#94a3b8] border-dashed bg-white transition-colors duration-200 hover:border-[#18a058]"
          @click="openLocalFile"
        >
          <SvgIcon name="import" class="mb-18px h-48px w-48px" />
          <div name="drop-title" class="text-20px font-600">
            {{ archiveLoading ? '正在下载并解析日志包…' : '拖拽 ZIP 到这里' }}
          </div>
          <div name="drop-description" class="mt-8px text-[#64748b]">
            或点击选择本地 ZIP 文件
          </div>
          <div name="privacy-tip" class="mt-24px text-12px text-[#94a3b8]">
            文件只在当前浏览器中解析，不会上传；远程日志会在本机缓存最多 7 天
          </div>
        </div>
      </NSpin>
    </div>
  </div>
</template>
