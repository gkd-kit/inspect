<script setup lang="ts">
import SelectorText from '@/components/selector/SelectorText.vue';
import { getNodeLabel, getNodeStyle } from '@/domain/snapshot/node';
import type { SearchResult, SelectorSearchResult } from './search_types';
import { useSnapshotStore } from './snapshot';

defineProps<{
  expandedKeys: number[];
  hasZipId?: number;
  results: SearchResult[];
}>();

const emit = defineEmits<{
  delete: [index: number];
  generateRules: [result: SelectorSearchResult];
  share: [result: SearchResult];
  'update:expandedKeys': [keys: number[]];
}>();

const snapshotStore = useSnapshotStore();
const { focusNode, updateFocusNode } = snapshotStore;
</script>

<template>
  <NCollapse
    :expandedNames="expandedKeys"
    @update:expandedNames="emit('update:expandedKeys', $event as number[])"
  >
    <NCollapseItem
      v-for="(result, index) in results"
      :key="result.key"
      :name="result.key"
    >
      <template #header>
        <span
          v-if="result.nodes.length > 1"
          underline
          leading-20px
          decoration-1
          m-r-4px
          gkd_code
          title="查询数量"
        >
          {{ result.nodes.length }}
        </span>
        <span
          break-all
          px-4px
          leading-20px
          class="app-subtle"
          gkd_code
          :title="result.gkd ? `选择器` : `搜索字符`"
        >
          <SelectorText
            v-if="result.gkd"
            :node="result.selector.ast"
            :source="result.selector.source"
          />
          <template v-else>{{ result.selector }}</template>
        </span>
        <span pl-4px />
        <NPopover v-if="result.gkd && result.fastQueryEvidence" trigger="hover">
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
      </template>

      <template #header-extra>
        <NButtonGroup>
          <NButton
            v-if="result.gkd && result.selector.canCopy"
            size="small"
            title="复制规则"
            @click.stop="emit('generateRules', result)"
          >
            <template #icon><SvgIcon name="copy" /></template>
          </NButton>
          <NButton
            v-if="hasZipId"
            size="small"
            :title="result.gkd ? `复制查询链接` : `复制搜索链接`"
            @click.stop="emit('share', result)"
          >
            <template #icon><SvgIcon name="share" /></template>
          </NButton>
          <NButton
            size="small"
            title="删除记录"
            @click.stop="emit('delete', index)"
          >
            <template #icon><SvgIcon name="delete" /></template>
          </NButton>
        </NButtonGroup>
      </template>

      <NScrollbar xScrollable style="max-height: 400px">
        <div flex gap-8px flex-wrap>
          <template
            v-if="!result.gkd || result.selector.connectKeys.length === 0"
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
                <NIcon><SvgIcon name="path" /></NIcon>
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
        <div un="h-10px" />
      </NScrollbar>
    </NCollapseItem>
  </NCollapse>
</template>
