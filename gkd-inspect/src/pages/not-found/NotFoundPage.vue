<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>
<template>
  <div
    class="w-(--gkd-w) h-(--gkd-h) flex flex-col items-center pt-[50px] gap-[8px]"
  >
    <div>当前页面不存在可访问资源</div>
    <RouterLink to="/"> 回到首页 </RouterLink>
  </div>
</template>
