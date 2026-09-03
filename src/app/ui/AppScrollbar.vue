<script setup lang="ts">
import GkBodyScrollbar from '@/shared/ui/GkBodyScrollbar.vue';

const isMobile = 'ontouchstart' in document.documentElement;
if (isMobile) {
  document.body.classList.add('mobile');
  document.documentElement.classList.add('mobile');
}
</script>

<template>
  <Teleport v-if="!isMobile" to="body">
    <GkBodyScrollbar />
  </Teleport>
</template>
