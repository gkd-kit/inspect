<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const { fullPath } = route.redirectedFrom ?? {};
</script>
<template>
  <div class="_404Page">
    <div v-if="fullPath">{{ `访问的地址 ` + fullPath + ` 不存在` }}</div>
    <div v-else>欢迎来到404页面</div>
    <a href="/" @click.prevent="$router.replace({ path: `/` })"> 回到首页 </a>
  </div>
</template>
<style scoped>
._404Page {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100vw;
  padding-top: 50px;
  gap: 20px;
}
</style>
