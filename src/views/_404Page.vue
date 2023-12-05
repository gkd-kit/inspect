<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const { fullPath } = route.redirectedFrom ?? {};
</script>
<template>
  <div flex flex-col flex-items-center w-100vw pt-50px gap-20px>
    <div v-if="fullPath">{{ `访问的地址 ` + fullPath + ` 不存在` }}</div>
    <div v-else>欢迎来到404页面</div>
    <a href="/" @click.prevent="$router.replace({ path: `/` })"> 回到首页 </a>
  </div>
</template>
