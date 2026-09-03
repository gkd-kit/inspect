<script lang="tsx" setup>
import { message } from '@/shared/services/feedback';
import {
  getLogPathSource,
  getLogQuerySource,
  getLogRoute,
  type LogSource,
} from '@/features/log-viewer/log_url';
import { getDragEventFiles } from '@/shared/lib/files';
import { getAppsPreviewData, type AppsPreviewData } from './apps_preview';
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
import type { LogVersionInfo, SourceLinkContext } from './source_links';
import {
  decodeLogText,
  getLogAppNames,
  getArchiveSourceLinkContext,
  getLogBuildKey,
  getLogSubscriptionNames,
  getLogVersionInfo,
  getDatabaseFiles,
  getDefaultLogEntry,
  isRawSubscription,
  loadLogArchive,
  MAX_JSON_SIZE,
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
import type { RouteLocationNormalized } from 'vue-router';
import { buildLogTreeData } from './log_tree';
import { downloadLogArchive } from './log_archive_fetch';
import LogArchiveSidebar from './LogArchiveSidebar.vue';
import LogEmptyState from './LogEmptyState.vue';
import LogPreviewPanel from './LogPreviewPanel.vue';
import LogToolbar from './LogToolbar.vue';
import type { PreviewKind } from './log_page_types';
import { useLogRetrace } from './useLogRetrace';

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
const appsView = shallowRef<`users` | `raw`>(`users`);
const clearError = () => {
  errorText.value = ``;
};
const updateAppsView = (value: `users` | `raw`) => {
  appsView.value = value;
};
const crashItems = shallowRef<CrashSummary[]>([]);
const crashDetail = shallowRef<CrashDetail>();
const crashDetailLoading = shallowRef(false);
const logItems = shallowRef<LogFileSummary[]>([]);
const logDetailPath = shallowRef(``);
const logDetailText = shallowRef<string>();
const logDetailError = shallowRef(``);
const logDetailLoading = shallowRef(false);
const sourceLinkContext = shallowRef<SourceLinkContext>();
const logVersionInfo = shallowRef<LogVersionInfo>();
const logBuildKey = shallowRef<string>();
const subscriptionItems = shallowRef<SubscriptionFileSummary[]>([]);
const subscriptionDetail = shallowRef<SubscriptionFileDetail>();
const subscriptionDetailStructured = shallowRef(false);
const subscriptionDetailLoading = shallowRef(false);
const jsonError = shallowRef(``);
const databaseData = shallowRef<Uint8Array>();
const walData = shallowRef<Uint8Array>();
const appNames = shallowRef<Record<string, string>>({});
const subscriptionNames = shallowRef<Record<string, string>>({});
const filePanelCollapsed = shallowRef(false);
const logToolbarRef = useTemplateRef('logToolbarRef');
let loadSequence = 0;
let previewSequence = 0;
let crashDetailSequence = 0;
let crashSummaryTask: Promise<CrashSummary[]> | undefined;
let logDetailSequence = 0;
let subscriptionDetailSequence = 0;
let subscriptionSummaryTask: Promise<SubscriptionFileSummary[]> | undefined;
let activeFetchController: AbortController | undefined;

const {
  autoRetraceText,
  crashRetraceState,
  getRetraceStateText,
  getRetraceTextState,
  logRetraceState,
  previewRetraceState,
  resetBuildRetrace,
  toggleCrashRetrace,
  toggleLogRetrace,
  togglePreviewRetrace,
} = useLogRetrace({
  buildKey: logBuildKey,
  crashDetail,
  logDetailText,
  previewText,
});

const selectedEntry = computed(() =>
  archive.value?.entryMap.get(selectedPath.value),
);

const clearCrashDetail = () => {
  crashDetailSequence++;
  crashDetail.value = undefined;
  crashRetraceState.value = undefined;
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
  logRetraceState.value = undefined;
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
  sourceLinkContext.value = undefined;
  logVersionInfo.value = undefined;
  subscriptionItems.value = [];
  subscriptionSummaryTask = undefined;
  clearLogDetail();
  clearSubscriptionDetail();
};

const clearPreview = () => {
  previewLoading.value = false;
  previewKind.value = `none`;
  previewText.value = ``;
  previewRetraceState.value = undefined;
  jsonValue.value = undefined;
  appsData.value = undefined;
  appsView.value = `users`;
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
      const text = decodeLogText(bytes);
      const state = getRetraceTextState(`text:${entry.path}`, text);
      previewRetraceState.value = state;
      previewText.value = getRetraceStateText(state);
      previewKind.value = `text`;
      autoRetraceText(
        state,
        `log`,
        () => previewRetraceState.value == state,
        (retracedText) => {
          if (previewRetraceState.value == state) {
            previewText.value = retracedText;
          }
        },
      );
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
  crashRetraceState.value = undefined;
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
    const detail = parseCrashDetail(raw, entry.path);
    if (detail.stackTrace) {
      const state = getRetraceTextState(
        `crash:${entry.path}`,
        detail.stackTrace,
      );
      crashRetraceState.value = state;
      crashDetail.value = markRaw({
        ...detail,
        stackTrace: getRetraceStateText(state),
      });
      autoRetraceText(
        state,
        `crash`,
        () => crashRetraceState.value == state,
        (stackTrace) => {
          if (crashRetraceState.value != state || !crashDetail.value) return;
          crashDetail.value = markRaw({ ...crashDetail.value, stackTrace });
        },
      );
    } else {
      crashDetail.value = markRaw(detail);
    }
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
  logRetraceState.value = undefined;
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
    const state = getRetraceTextState(`log:${entry.path}`, text);
    logRetraceState.value = state;
    logDetailText.value = getRetraceStateText(state);
    autoRetraceText(
      state,
      `log`,
      () => logRetraceState.value == state,
      (retracedText) => {
        if (logRetraceState.value == state) logDetailText.value = retracedText;
      },
    );
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
  resetBuildRetrace();
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
    const [resolvedVersionInfo, resolvedSourceLinkContext, resolvedBuildKey] =
      await Promise.all([
        getLogVersionInfo(result),
        getArchiveSourceLinkContext(result),
        getLogBuildKey(result),
      ]);
    if (sequence != loadSequence) return;
    archive.value = result;
    logVersionInfo.value = resolvedVersionInfo
      ? markRaw(resolvedVersionInfo)
      : undefined;
    sourceLinkContext.value = resolvedSourceLinkContext
      ? markRaw(resolvedSourceLinkContext)
      : undefined;
    logBuildKey.value = resolvedBuildKey;
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

  const { data, name } = await downloadLogArchive(source, controller);
  if (sequence != loadSequence) return;
  const loaded = await loadArchive(data, name, sequence);
  if (loaded) void setLogArchiveCache(source.url, name, data);
};

const getRouteSource = (
  target: Pick<RouteLocationNormalized, 'path' | 'query' | 'params'>,
) => {
  if (target.path == `/log`) return getLogQuerySource(target.query.url);
  return getLogPathSource(target.params.pathMatch);
};

const loadFromRoute = async (
  target: Pick<RouteLocationNormalized, 'path' | 'query' | 'params'> = route,
) => {
  activeFetchController?.abort();
  resetBuildRetrace();
  const controller = new AbortController();
  activeFetchController = controller;
  const source = getRouteSource(target);
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

onMounted(() => loadFromRoute(route));
onBeforeRouteUpdate((to) => loadFromRoute(to));

onBeforeUnmount(() => {
  activeFetchController?.abort();
  resetBuildRetrace();
});

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

const openLocalFile = () => logToolbarRef.value?.openLocalFile();
const updateInputUrl = (value: string) => {
  inputUrl.value = value;
};
const updateFilePanelCollapsed = (collapsed: boolean) => {
  filePanelCollapsed.value = collapsed;
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

const treeData = computed(() => buildLogTreeData(archive.value));

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
    <LogToolbar
      ref="logToolbarRef"
      :archiveLoading="archiveLoading"
      :inputUrl="inputUrl"
      :logVersionInfo="logVersionInfo"
      @update:inputUrl="updateInputUrl"
      @submit="submitUrl"
      @files="importLocalFile"
    />

    <NAlert v-if="errorText" type="error" closable @close="clearError">
      {{ errorText }}
    </NAlert>

    <div
      v-if="archive"
      name="log-workspace"
      class="flex min-h-0 flex-1 gap-10px"
    >
      <LogArchiveSidebar
        :archive="archive"
        :collapsed="filePanelCollapsed"
        :selectedPath="selectedPath"
        :treeData="treeData"
        @update:collapsed="updateFilePanelCollapsed"
        @select="updateSelectedKeys"
      />

      <LogPreviewPanel
        :selectedEntry="selectedEntry"
        :selectedPath="selectedPath"
        :previewKind="previewKind"
        :previewLoading="previewLoading"
        :previewText="previewText"
        :jsonError="jsonError"
        :jsonValue="jsonValue"
        :appsData="appsData"
        :appsView="appsView"
        :logBuildKey="logBuildKey"
        :previewRetraceState="previewRetraceState"
        :crashItems="crashItems"
        :crashDetail="crashDetail"
        :crashDetailLoading="crashDetailLoading"
        :crashRetraceState="crashRetraceState"
        :logItems="logItems"
        :logDetailPath="logDetailPath"
        :logDetailText="logDetailText"
        :logDetailError="logDetailError"
        :logDetailLoading="logDetailLoading"
        :logRetraceState="logRetraceState"
        :sourceLinkContext="sourceLinkContext"
        :subscriptionItems="subscriptionItems"
        :subscriptionDetail="subscriptionDetail"
        :subscriptionDetailStructured="subscriptionDetailStructured"
        :subscriptionDetailLoading="subscriptionDetailLoading"
        :databaseData="databaseData"
        :walData="walData"
        :appNames="appNames"
        :subscriptionNames="subscriptionNames"
        @update:appsView="updateAppsView"
        @togglePreviewRetrace="togglePreviewRetrace"
        @selectCrash="loadCrashDetail"
        @toggleCrashRetrace="toggleCrashRetrace"
        @selectLog="loadLogFileDetail"
        @toggleLogRetrace="toggleLogRetrace"
        @selectSubscription="loadSubscriptionDetail"
      />
    </div>

    <LogEmptyState v-else :loading="archiveLoading" @open="openLocalFile" />
  </div>
</template>
