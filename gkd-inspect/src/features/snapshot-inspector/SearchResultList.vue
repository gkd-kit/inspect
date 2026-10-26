<script setup lang="ts">
import {
  NButton,
  NButtonGroup,
  NCollapse,
  NCollapseItem,
  NIcon,
  NPopover,
  NScrollbar,
  NTag,
} from 'naive-ui';
import { computed } from 'vue';

import GkSvg from '@/shared/ui/GkSvg.vue';
import SelectorText from '@/entities/selector/ui/SelectorText.vue';
import {
  collectSelectorPresetIdentities,
  normalizeSelectorIdentity,
} from '@/features/selector-library/library';
import { getNodeLabel, getNodeStyle } from '@/entities/snapshot/node';
import { selectorLibrary } from '@/features/selector-library/store';
import type { SearchResult, SelectorSearchResult } from './search_types';
import { useSnapshotStore } from './snapshot';

const props = defineProps<{
  expandedKeys: number[];
  hasZipId?: number;
  results: SearchResult[];
}>();

const emit = defineEmits<{
  delete: [index: number];
  composeRules: [result: SelectorSearchResult];
  generateRules: [result: SelectorSearchResult];
  saveSelector: [result: SelectorSearchResult];
  share: [result: SearchResult];
  'update:expandedKeys': [keys: number[]];
}>();

const snapshotStore = useSnapshotStore();
const { focusNode, updateFocusNode } = snapshotStore;
const savedResultKeys = computed(() => {
  const keys = new Set<number>();
  const snapshot = snapshotStore.snapshot.value;
  if (!snapshot) return keys;
  const context = { appId: snapshot.appId, activityId: snapshot.activityId };
  const identities = collectSelectorPresetIdentities(
    selectorLibrary.items,
    context,
  );
  for (const result of props.results) {
    if (
      result.gkd &&
      identities.has(normalizeSelectorIdentity(result.selector.toString()))
    ) {
      keys.add(result.key);
    }
  }
  return keys;
});
const isSelectorSaved = (result: SelectorSearchResult) => {
  return savedResultKeys.value.has(result.key);
};
const toggleResult = (key: number) => {
  emit(
    'update:expandedKeys',
    props.expandedKeys.includes(key)
      ? props.expandedKeys.filter((value) => value !== key)
      : [...props.expandedKeys, key],
  );
};
const handleResultToggle = (event: MouseEvent, key: number) => {
  // 如果当前操作是在选中文字，就不要触发展开/收起
  if (window.getSelection()?.toString()) {
    event.preventDefault();
    return;
  }
  toggleResult(key);
};
</script>

<template>
  <NCollapse
    class="search-result-list"
    :expandedNames="expandedKeys"
    @update:expandedNames="emit('update:expandedKeys', $event as number[])"
  >
    <NCollapseItem
      v-for="(result, index) in results"
      :key="result.key"
      :name="result.key"
    >
      <template #header>
        <div
          class="flex flex-col gap-[8px] min-w-0 w-full cursor-default"
          @click.stop
        >
          <button
            type="button"
            class="result-toggle"
            :aria-expanded="expandedKeys.includes(result.key)"
            :aria-label="`${expandedKeys.includes(result.key) ? '收起' : '展开'} ${result.nodes.length} 个节点`"
            @click="handleResultToggle($event, result.key)"
          >
            <span
              class="selector-result-text bg-(--app-subtle)! break-all px-[4px] leading-[20px] font-mono!"
              :title="result.gkd ? `选择器` : `搜索字符`"
            >
              <SelectorText
                v-if="result.gkd"
                :tokens="result.selector.tokens"
                :source="result.selector.source"
              />
              <template v-else>{{ result.selector }}</template>
            </span>
            <span class="result-count">{{ result.nodes.length }} 个节点</span>
          </button>
          <div
            class="flex flex-wrap items-center justify-between gap-[8px]"
            @click.stop
          >
            <NPopover
              v-if="result.gkd && result.fastQueryEvidence"
              trigger="hover"
            >
              <template #trigger>
                <NTag
                  size="small"
                  :type="
                    result.fastQueryEvidence.status == 'supported'
                      ? 'success'
                      : result.fastQueryEvidence.status == 'unsupported'
                        ? 'default'
                        : 'warning'
                  "
                >
                  {{ result.fastQueryEvidence.label }}
                </NTag>
              </template>
              {{ result.fastQueryEvidence.reason }}
            </NPopover>
            <NButtonGroup class="ml-auto shrink-0">
              <NButton
                v-if="result.gkd"
                size="small"
                :disabled="isSelectorSaved(result)"
                :title="isSelectorSaved(result) ? '已收藏' : '收藏选择器'"
                @click.stop="emit('saveSelector', result)"
              >
                <template #icon>
                  <GkSvg
                    :name="
                      isSelectorSaved(result) ? 'favorite' : 'favorite-outline'
                    "
                    :class="
                      isSelectorSaved(result)
                        ? 'text-[#f0a020]'
                        : 'text-[var(--app-muted)]'
                    "
                  />
                </template>
              </NButton>
              <NButton
                v-if="result.gkd && result.selector.canCopy"
                size="small"
                title="复制规则"
                @click.stop="emit('generateRules', result)"
              >
                <template #icon><GkSvg name="copy" /></template>
              </NButton>
              <NButton
                v-if="result.gkd && result.selector.canCopy"
                size="small"
                title="编排规则"
                @click.stop="emit('composeRules', result)"
              >
                <template #icon><GkSvg name="test" /></template>
              </NButton>
              <NButton
                v-if="hasZipId"
                size="small"
                :title="result.gkd ? `复制查询链接` : `复制搜索链接`"
                @click.stop="emit('share', result)"
              >
                <template #icon><GkSvg name="share" /></template>
              </NButton>
              <NButton
                size="small"
                title="删除记录"
                @click.stop="emit('delete', index)"
              >
                <template #icon><GkSvg name="delete" /></template>
              </NButton>
            </NButtonGroup>
          </div>
        </div>
      </template>

      <NScrollbar xScrollable style="max-height: 400px">
        <div class="flex gap-[8px] flex-wrap">
          <template
            v-if="
              !result.gkd ||
              !result.results.some((match) =>
                match.units.some((unit) => unit.steps.length > 0),
              )
            "
          >
            <NButton
              v-for="resultNode in result.nodes"
              :key="resultNode.id"
              size="small"
              :style="getNodeStyle(resultNode, focusNode)"
              @click="updateFocusNode(resultNode)"
            >
              {{ getNodeLabel(resultNode) }}
            </NButton>
          </template>
          <template v-else>
            <NButtonGroup v-for="(resultNode, i) in result.nodes" :key="i">
              <NButton
                size="small"
                @click="
                  snapshotStore.showTrack(result.selector, result.results[i])
                "
              >
                <NIcon><GkSvg name="path" /></NIcon>
              </NButton>
              <NButton
                size="small"
                :style="getNodeStyle(resultNode, focusNode)"
                @click="updateFocusNode(resultNode)"
              >
                {{ getNodeLabel(resultNode) }}
              </NButton>
            </NButtonGroup>
          </template>
        </div>
        <div class="h-[10px]" />
      </NScrollbar>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped>
.search-result-list :deep(.n-collapse-item__header-main) {
  align-items: flex-start;
  min-width: 0;
}
.search-result-list :deep(.n-collapse-item-arrow) {
  align-self: flex-start;
  margin-top: 2px;
}
.search-result-list :deep(.n-collapse-item__content-inner) {
  padding-top: 12px;
}
.result-toggle {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  /* 允许选择器文本被鼠标选中 */
  user-select: text;
  -webkit-user-select: text;
}
.result-toggle:focus-visible {
  outline: 2px solid #18a058;
  outline-offset: 3px;
  border-radius: 2px;
}
.result-count {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
</style>
