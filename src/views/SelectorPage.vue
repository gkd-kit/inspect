<script setup lang="ts">
import { useAutoHeight, useAutoWidth } from '@/utils/others';

useAutoHeight();
useAutoWidth();

const text = shallowRef('');
</script>
<template>
  <div flex flex-col items-center p-8px>
    <NInput
      v-model:value="text"
      type="textarea"
      placeholder="请输入选择器"
      class="gkd_code"
    />
  </div>
</template>
