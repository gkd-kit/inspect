<script setup lang="ts">
defineProps<{
  title: string;
  count: number;
  listLabel: string;
  listActive: boolean;
  detailText?: string;
  detailTitle?: string;
  detailMeta?: string;
}>();

const emit = defineEmits<{
  selectList: [];
}>();
</script>

<template>
  <div
    name="directory-preview-header"
    class="h-40px flex flex-none items-stretch"
  >
    <div class="flex flex-none items-center gap-8px pr-14px font-600">
      <span>{{ title }}</span>
      <NTag size="small" round>{{ count }}</NTag>
    </div>
    <button
      type="button"
      class="h-full flex-none cursor-pointer border-b-2 bg-transparent px-12px transition-colors"
      :class="
        listActive
          ? 'border-[#18a058] text-[#18a058] font-600'
          : 'border-transparent text-[#475569] hover:text-[#18a058]'
      "
      :aria-pressed="listActive"
      @click="emit('selectList')"
    >
      {{ listLabel }}
    </button>
    <div class="min-w-0 flex-1" />
    <div
      v-if="!listActive && detailText"
      class="min-w-0 flex items-center gap-10px pl-14px"
    >
      <span
        class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-600"
        :title="detailTitle || detailText"
      >
        {{ detailText }}
      </span>
      <span v-if="detailMeta" class="flex-none text-12px text-[#64748b]">
        {{ detailMeta }}
      </span>
    </div>
  </div>
</template>
