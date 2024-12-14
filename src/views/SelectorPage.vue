<script setup lang="ts">
import { useAutoHeight } from '@/utils/others';

// 页面: 输入框, 输入后解析当前选择器的结构
useAutoHeight();
</script>
<template>
  <div flex flex-col items-center p-8px>
    <input />
    <div v-for="i in 60" :key="i">
      {{ Math.random() }}
    </div>
  </div>
</template>
