<script setup lang="ts">
import type { RawSubscription } from '@gkd-kit/api';
import AppsPreview from './AppsPreview.vue';
import type { AppsPreviewData } from './apps_preview';
import CrashPreview from './CrashPreview.vue';
import type { CrashDetail, CrashSummary } from './crash_preview';
import type {
  LogFileSummary,
  SubscriptionFileDetail,
  SubscriptionFileSummary,
} from './directory_preview';
import JsonPreview from './JsonPreview.vue';
import LogDirectoryPreview from './LogDirectoryPreview.vue';
import type { LogEntry } from './log';
import { formatBytes, isRawSubscription } from './log';
import type { PreviewKind } from './log_page_types';
import type { SourceLinkContext } from './source_links';
import SqlitePreview from './SqlitePreview.vue';
import StackRetraceButton from './StackRetraceButton.vue';
import SubscriptionDirectoryPreview from './SubscriptionDirectoryPreview.vue';
import SubscriptionPreview from './SubscriptionPreview.vue';
import TextViewer from './text_viewer/TextViewer.vue';
import type { StackRetraceTextState } from './useLogRetrace';

defineProps<{
  appNames: Record<string, string>;
  appsData?: AppsPreviewData;
  appsView: `users` | `raw`;
  crashDetail?: CrashDetail;
  crashDetailLoading: boolean;
  crashItems: CrashSummary[];
  crashRetraceState?: StackRetraceTextState;
  databaseData?: Uint8Array;
  jsonError: string;
  jsonValue?: unknown;
  logBuildKey?: string;
  logDetailError: string;
  logDetailLoading: boolean;
  logDetailPath: string;
  logDetailText?: string;
  logItems: LogFileSummary[];
  logRetraceState?: StackRetraceTextState;
  previewKind: PreviewKind;
  previewLoading: boolean;
  previewRetraceState?: StackRetraceTextState;
  previewText: string;
  selectedEntry?: LogEntry;
  selectedPath: string;
  sourceLinkContext?: SourceLinkContext;
  subscriptionDetail?: SubscriptionFileDetail;
  subscriptionDetailLoading: boolean;
  subscriptionDetailStructured: boolean;
  subscriptionItems: SubscriptionFileSummary[];
  subscriptionNames: Record<string, string>;
  walData?: Uint8Array;
}>();

const emit = defineEmits<{
  selectCrash: [path: string];
  selectLog: [path: string];
  selectSubscription: [path: string];
  toggleCrashRetrace: [];
  toggleLogRetrace: [];
  togglePreviewRetrace: [];
  'update:appsView': [view: `users` | `raw`];
}>();
</script>

<template>
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
      <div
        v-if="previewKind == 'apps' && appsData"
        name="apps-overview"
        class="flex flex-none items-center gap-6px whitespace-nowrap text-13px"
      >
        <NButtonGroup size="small">
          <NButton
            :type="appsView == 'users' ? 'primary' : 'default'"
            :secondary="appsView == 'users'"
            @click="emit('update:appsView', 'users')"
          >
            按用户查看
          </NButton>
          <NButton
            :type="appsView == 'raw' ? 'primary' : 'default'"
            :secondary="appsView == 'raw'"
            @click="emit('update:appsView', 'raw')"
          >
            原始 JSON
          </NButton>
        </NButtonGroup>
        <span class="mx-6px h-16px border-l border-[#e2e8f0]" />
        <span class="text-[#64748b]">应用安装记录</span>
        <span class="font-600">{{ appsData.totalApps }}</span>
        <span class="mx-4px text-[#cbd5e1]">·</span>
        <span class="text-[#64748b]">设备用户</span>
        <span class="font-600">{{ appsData.users.length }}</span>
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
          :key="selectedEntry?.path"
          :value="previewText"
          :documentKey="selectedEntry?.path"
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
              <div name="preview-size" class="mt-3px text-12px text-[#64748b]">
                {{ formatBytes(selectedEntry.size) }}
              </div>
            </div>
            <StackRetraceButton
              :available="!!logBuildKey && !!previewRetraceState?.available"
              :loading="previewRetraceState?.loading"
              :retraced="previewRetraceState?.active"
              @toggle="emit('togglePreviewRetrace')"
            />
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
        :key="selectedPath"
        :items="crashItems"
        :detail="crashDetail"
        :detailLoading="crashDetailLoading"
        :retraceAvailable="!!logBuildKey && !!crashRetraceState?.available"
        :retraceLoading="crashRetraceState?.loading"
        :retraceActive="crashRetraceState?.active"
        :sourceLinkContext="sourceLinkContext"
        @select="emit('selectCrash', $event)"
        @toggleRetrace="emit('toggleCrashRetrace')"
      />
      <LogDirectoryPreview
        v-else-if="previewKind == 'log-directory'"
        :key="selectedPath"
        :items="logItems"
        :detailPath="logDetailPath"
        :detailText="logDetailText"
        :detailError="logDetailError"
        :detailLoading="logDetailLoading"
        :retraceAvailable="!!logBuildKey && !!logRetraceState?.available"
        :retraceLoading="logRetraceState?.loading"
        :retraceActive="logRetraceState?.active"
        :sourceLinkContext="sourceLinkContext"
        @select="emit('selectLog', $event)"
        @toggleRetrace="emit('toggleLogRetrace')"
      />
      <SubscriptionDirectoryPreview
        v-else-if="previewKind == 'subscription-directory'"
        :key="selectedPath"
        :items="subscriptionItems"
        :detail="subscriptionDetail"
        :detailStructured="subscriptionDetailStructured"
        :detailLoading="subscriptionDetailLoading"
        @select="emit('selectSubscription', $event)"
      />
      <AppsPreview
        v-else-if="previewKind == 'apps' && appsData"
        :key="selectedPath"
        :data="appsData"
        :value="jsonValue"
        :raw="previewText"
        :view="appsView"
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
</template>
