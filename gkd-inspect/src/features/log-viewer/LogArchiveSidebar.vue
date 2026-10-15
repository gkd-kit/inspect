<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import { formatBytes, type LogArchive } from './log';
import type { LogTreeOption } from './log_tree';

defineProps<{
  archive: LogArchive;
  collapsed: boolean;
  selectedPath: string;
  treeData: LogTreeOption[];
}>();

const emit = defineEmits<{
  select: [keys: Array<string | number>];
  'update:collapsed': [collapsed: boolean];
}>();
</script>

<template>
  <div
    name="log-file-panel"
    class="box-border flex min-h-0 flex-col rounded-6px border border-[#e2e8f0] bg-white transition-[width,min-width] duration-180 ease"
    :class="collapsed ? 'w-44px min-w-44px' : 'w-300px min-w-300px'"
  >
    <div
      name="archive-meta"
      class="flex min-w-0 items-start gap-8px"
      :class="
        collapsed
          ? 'justify-center border-b-0 p-8px'
          : 'border-b border-[#e5e7eb] p-12px'
      "
    >
      <div v-if="!collapsed" name="archive-meta-content" class="min-w-0 flex-1">
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
        :aria-expanded="!collapsed"
        :aria-label="collapsed ? '展开文件列表' : '收起文件列表'"
        :title="collapsed ? '展开文件列表' : '收起文件列表'"
        @click="emit('update:collapsed', !collapsed)"
      >
        <GkSvg
          name="arrow"
          class="h-17px w-17px transition-transform duration-180 ease"
          :class="collapsed ? '-rotate-90' : 'rotate-90'"
        />
      </button>
    </div>
    <NTree
      v-if="!collapsed"
      blockLine
      virtualScroll
      defaultExpandAll
      :data="treeData"
      :selectedKeys="selectedPath ? [selectedPath] : []"
      class="min-h-0 flex-1 p-8px"
      @update:selectedKeys="emit('select', $event)"
    />
  </div>
</template>
