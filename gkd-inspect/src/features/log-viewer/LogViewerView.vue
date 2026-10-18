<script lang="tsx" setup>
import { NAlert } from 'naive-ui';
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEventListener } from '@vueuse/core';

import { useLatestTask } from '@/shared/lib/latest_task';
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
import { getDiagnosticKind, STARTUP_TREE_KEY } from './diagnostic_preview';
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
const inputUrl = shallowRef(``);
const previewKind = shallowRef<PreviewKind>(`none`);
const previewText = shallowRef(``);
const jsonValue = shallowRef<unknown>();
const appsData = shallowRef<AppsPreviewData>();
const appsView = shallowRef<`users` | `raw`>(`users`);
const clearError = () => {
  archiveTask.clearError();
  previewTask.clearError();
};
const updateAppsView = (value: `users` | `raw`) => {
  appsView.value = value;
};
const crashItems = shallowRef<CrashSummary[]>([]);
const crashDetail = shallowRef<CrashDetail>();
const logItems = shallowRef<LogFileSummary[]>([]);
const logDetailPath = shallowRef(``);
const logDetailText = shallowRef<string>();
const sourceLinkContext = shallowRef<SourceLinkContext>();
const logVersionInfo = shallowRef<LogVersionInfo>();
const logBuildKey = shallowRef<string>();
const subscriptionItems = shallowRef<SubscriptionFileSummary[]>([]);
const subscriptionDetail = shallowRef<SubscriptionFileDetail>();
const subscriptionDetailStructured = shallowRef(false);
const jsonError = shallowRef(``);
const previewResourceKey = shallowRef(Symbol());
const databaseData = shallowRef<Uint8Array>();
const walData = shallowRef<Uint8Array>();
const appNames = shallowRef<Record<string, string>>({});
const subscriptionNames = shallowRef<Record<string, string>>({});
const filePanelCollapsed = shallowRef(false);
const logToolbarRef = useTemplateRef('logToolbarRef');
let activeFetchController: AbortController | undefined;
let localNavigation = false;

const {
  autoRetraceText,
  crashRetraceState,
  setCrashRetraceState,
  getRetraceStateText,
  getCachedRetraceTextState,
  getRetraceTextState,
  logRetraceState,
  setLogRetraceState,
  previewRetraceState,
  setPreviewRetraceState,
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
  crashTask.cancel();
  crashDetail.value = undefined;
  setCrashRetraceState(undefined);
};
const clearLogDetail = () => {
  logTask.cancel();
  logDetailPath.value = '';
  logDetailText.value = undefined;
  setLogRetraceState(undefined);
};
const clearSubscriptionDetail = () => {
  subscriptionTask.cancel();
  subscriptionDetail.value = undefined;
  subscriptionDetailStructured.value = false;
};
const clearPreview = () => {
  previewResourceKey.value = Symbol();
  previewKind.value = 'none';
  previewText.value = '';
  setPreviewRetraceState(undefined);
  jsonValue.value = undefined;
  appsData.value = undefined;
  appsView.value = 'users';
  jsonError.value = '';
  databaseData.value = undefined;
  walData.value = undefined;
  appNames.value = {};
  subscriptionNames.value = {};
  clearCrashDetail();
  clearLogDetail();
  clearSubscriptionDetail();
};
const preparePreview = async (
  current: LogArchive,
  path: string,
): Promise<() => void> => {
  if (path === CRASH_TREE_KEY) {
    const items = await loadCrashSummaries(
      getCrashEntries(current.entries),
      async (entry) =>
        decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE)),
    );
    return () => {
      crashItems.value = markRaw(items);
      previewKind.value = 'crash';
    };
  }
  if (path === LOG_TREE_KEY) {
    const items = getLogFileSummaries(getLogDirectoryEntries(current.entries));
    return () => {
      logItems.value = markRaw(items);
      previewKind.value = 'log-directory';
    };
  }
  if (path === SUBSCRIPTION_TREE_KEY) {
    const items = await loadSubscriptionFileSummaries(
      getSubscriptionDirectoryEntries(current.entries),
      async (entry) =>
        decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE)),
    );
    return () => {
      subscriptionItems.value = markRaw(items);
      previewKind.value = 'subscription-directory';
    };
  }
  if (path === STARTUP_TREE_KEY)
    return () => {
      previewKind.value = 'startup-directory';
    };
  const entry = current.entryMap.get(path);
  if (!entry) return () => {};
  if (entry.kind === 'database') {
    const [files, apps, subscriptions] = await Promise.all([
      getDatabaseFiles(current, entry),
      getLogAppNames(current),
      getLogSubscriptionNames(current),
    ]);
    return () => {
      databaseData.value = markRaw(files.database);
      walData.value = files.wal ? markRaw(files.wal) : undefined;
      appNames.value = markRaw(apps);
      subscriptionNames.value = markRaw(subscriptions);
      previewKind.value = 'database';
    };
  }
  if (entry.kind === 'text') {
    const text = decodeLogText(await readEntryBytes(entry));
    return () => {
      const state = getRetraceTextState('text:' + entry.path, text);
      setPreviewRetraceState(state);
      previewText.value = getRetraceStateText(state);
      previewKind.value = 'text';
    };
  }
  if (entry.kind === 'json') {
    const raw = decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE));
    try {
      const value: unknown = JSON.parse(raw);
      const tooLarge = isJsonTreeTooLarge(value);
      const apps =
        entry.path.toLowerCase().split('/').at(-1) === 'apps.json' && !tooLarge
          ? getAppsPreviewData(value)
          : undefined;
      const kind: PreviewKind =
        !tooLarge &&
        getDiagnosticKind(entry.path) &&
        value != null &&
        typeof value === 'object' &&
        !Array.isArray(value)
          ? 'diagnostic'
          : apps
            ? 'apps'
            : !tooLarge && shouldUseSubscriptionPreview(entry, value)
              ? 'subscription'
              : 'json';
      return () => {
        previewText.value = raw;
        jsonValue.value = value;
        appsData.value = apps ? markRaw(apps) : undefined;
        previewKind.value = kind;
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return () => {
        previewText.value = raw;
        jsonError.value = detail;
        previewKind.value = 'invalid-json';
      };
    }
  }
  return () => {
    previewKind.value = 'unsupported';
  };
};
const startPreviewRetrace = () => {
  const state = previewRetraceState.value;
  autoRetraceText(
    state,
    'log',
    () => previewRetraceState.value === state,
    (text) => {
      previewText.value = text;
    },
  );
};
const previewTask = useLatestTask(async ({ commit }, path: string) => {
  const current = archive.value;
  if (!current) return;
  const apply = await preparePreview(current, path);
  if (
    commit(() => {
      clearPreview();
      selectedPath.value = path;
      apply();
    })
  )
    startPreviewRetrace();
});
const previewLoading = previewTask.loading;
const showEntry = (entry: LogEntry | undefined) =>
  entry && previewTask.run(entry.path);
const showCrashPreview = () => previewTask.run(CRASH_TREE_KEY);
const showLogDirectoryPreview = () => previewTask.run(LOG_TREE_KEY);
const showSubscriptionDirectoryPreview = () =>
  previewTask.run(SUBSCRIPTION_TREE_KEY);
const showStartupPreview = () => previewTask.run(STARTUP_TREE_KEY);

const crashTask = useLatestTask(async ({ commit }, path: string) => {
  const entry = archive.value?.entryMap.get(path);
  if (!entry || !isCrashPath(entry.path)) return;
  let detail: CrashDetail;
  try {
    detail = isCrashJsonPath(path)
      ? parseCrashDetail(
          decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE)),
          path,
        )
      : getUnsupportedCrashDetail(path);
  } catch (error) {
    detail = getUnreadableCrashDetail(path, error);
  }
  if (
    !commit(() => {
      const state = detail.stackTrace
        ? getRetraceTextState('crash:' + path, detail.stackTrace)
        : undefined;
      setCrashRetraceState(state);
      crashDetail.value = markRaw(
        state ? { ...detail, stackTrace: getRetraceStateText(state) } : detail,
      );
    })
  )
    return;
  const state = crashRetraceState.value;
  autoRetraceText(
    state,
    'crash',
    () => crashRetraceState.value === state,
    (stackTrace) => {
      if (crashDetail.value)
        crashDetail.value = markRaw({ ...crashDetail.value, stackTrace });
    },
  );
});
const loadCrashDetail = crashTask.run;
const crashDetailLoading = crashTask.loading;
const logTask = useLatestTask(async ({ commit }, path: string) => {
  const entry = archive.value?.entryMap.get(path);
  if (!entry || !isLogDirectoryPath(path)) return;
  const cached = getCachedRetraceTextState('log:' + path);
  const text =
    cached?.originalText ?? decodeLogText(await readEntryBytes(entry));
  if (
    !commit(() => {
      const state = getRetraceTextState('log:' + path, text);
      logDetailPath.value = path;
      setLogRetraceState(state);
      logDetailText.value = getRetraceStateText(state);
    })
  )
    return;
  const state = logRetraceState.value;
  autoRetraceText(
    state,
    'log',
    () => logRetraceState.value === state,
    (text) => {
      logDetailText.value = text;
    },
  );
});
const loadLogFileDetail = logTask.run;
const logDetailLoading = logTask.loading;
const logDetailError = computed(() => logTask.error.value?.message || '');
const subscriptionTask = useLatestTask(async ({ commit }, path: string) => {
  const entry = archive.value?.entryMap.get(path);
  if (!entry || !isSubscriptionDirectoryPath(path)) return;
  let detail: SubscriptionFileDetail;
  try {
    detail = isSubscriptionJsonPath(path)
      ? parseSubscriptionFileDetail(
          decodeLogText(await readEntryBytes(entry, MAX_JSON_SIZE)),
          path,
        )
      : getUnsupportedSubscriptionDetail(path);
  } catch (error) {
    detail = getUnreadableSubscriptionDetail(path, error);
  }
  commit(() => {
    subscriptionDetail.value = markRaw(detail);
    subscriptionDetailStructured.value =
      detail.parsed && isRawSubscription(detail.value);
  });
});
const loadSubscriptionDetail = subscriptionTask.run;
const subscriptionDetailLoading = subscriptionTask.loading;

const prepareArchive = async (
  data: Blob | ArrayBuffer | Uint8Array,
  name: string,
) => {
  const result = await loadLogArchive(data, name || 'log.zip');
  const initial = getDefaultLogEntry(result);
  const path = initial
    ? isLogDirectoryPath(initial.path)
      ? LOG_TREE_KEY
      : isCrashPath(initial.path)
        ? CRASH_TREE_KEY
        : isSubscriptionDirectoryPath(initial.path)
          ? SUBSCRIPTION_TREE_KEY
          : initial.path
    : getLogDirectoryEntries(result.entries).length
      ? LOG_TREE_KEY
      : getCrashEntries(result.entries).length
        ? CRASH_TREE_KEY
        : getSubscriptionDirectoryEntries(result.entries).length
          ? SUBSCRIPTION_TREE_KEY
          : '';
  const [version, source, build, preview] = await Promise.all([
    getLogVersionInfo(result),
    getArchiveSourceLinkContext(result),
    getLogBuildKey(result),
    preparePreview(result, path),
  ]);
  return () => {
    previewTask.cancel();
    clearPreview();
    resetBuildRetrace();
    crashItems.value = [];
    logItems.value = [];
    subscriptionItems.value = [];
    archive.value = result;
    selectedPath.value = path;
    logVersionInfo.value = version ? markRaw(version) : undefined;
    sourceLinkContext.value = source ? markRaw(source) : undefined;
    logBuildKey.value = build;
    preview();
  };
};
const archiveTask = useLatestTask(
  async (
    { commit, isCurrent },
    input:
      | { file: File }
      | { source: LogSource; controller: AbortController }
      | undefined,
  ) => {
    if (!input) {
      commit(() => {
        previewTask.cancel();
        clearPreview();
        resetBuildRetrace();
        archive.value = undefined;
        selectedPath.value = '';
        inputUrl.value = '';
        crashItems.value = [];
        logItems.value = [];
        subscriptionItems.value = [];
        sourceLinkContext.value = undefined;
        logVersionInfo.value = undefined;
      });
      return;
    }
    let apply: () => void;
    if ('file' in input) {
      apply = await prepareArchive(input.file, input.file.name);
      if (!isCurrent()) return;
      if (route.fullPath !== '/log') {
        localNavigation = true;
        try {
          if (await router.replace('/log')) return;
        } finally {
          localNavigation = false;
        }
      }
    } else {
      const cached = await getLogArchiveCache(input.source.url);
      if (!isCurrent()) return;
      let cachedApply: (() => void) | undefined;
      if (cached) {
        try {
          cachedApply = await prepareArchive(cached.data, cached.name);
        } catch {
          if (!isCurrent()) return;
          await removeLogArchiveCache(input.source.url);
        }
      }
      if (!isCurrent()) return;
      if (cachedApply) apply = cachedApply;
      else {
        const { data, name } = await downloadLogArchive(
          input.source,
          input.controller,
        );
        if (!isCurrent()) return;
        apply = await prepareArchive(data, name);
        if (isCurrent()) void setLogArchiveCache(input.source.url, name, data);
      }
    }
    if (
      commit(() => {
        apply();
        inputUrl.value = 'source' in input ? input.source.url : '';
      })
    )
      startPreviewRetrace();
  },
);
const archiveLoading = archiveTask.loading;
const errorText = computed(
  () =>
    archiveTask.error.value?.message || previewTask.error.value?.message || '',
);

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
  const controller = new AbortController();
  activeFetchController = controller;
  const source = getRouteSource(target);
  await archiveTask.run(source ? { source, controller } : undefined);
};
onMounted(() => {
  void loadFromRoute(route);
});
const removeRouteHook = router.afterEach((to, _from, failure) => {
  if (failure) return;
  if (localNavigation && to.fullPath === '/log') return;
  if (to.path === '/log' || to.path.startsWith('/log/')) void loadFromRoute(to);
  else {
    activeFetchController?.abort();
    archiveTask.cancel();
    previewTask.cancel();
  }
});
onBeforeUnmount(() => {
  removeRouteHook();
  activeFetchController?.abort();
  archiveTask.cancel();
  previewTask.cancel();
  crashTask.cancel();
  logTask.cancel();
  subscriptionTask.cancel();
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
  await archiveTask.run({ file });
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
  if (path == STARTUP_TREE_KEY) {
    showStartupPreview();
    return;
  }
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
    class="box-border flex min-h-[700px] min-w-[1200px] flex-col gap-[10px] bg-[#f8fafc] p-[10px] w-(--gkd-w) h-(--gkd-h)"
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
      class="flex min-h-0 flex-1 gap-[10px]"
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
        :archive="archive"
        :resourceKey="previewResourceKey"
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
