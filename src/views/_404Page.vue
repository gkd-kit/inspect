<template>
  <div flex flex-col flex-items-center w-full pt-50px gap-8px>
    <div>当前页面不存在可访问资源</div>
    <a href="/" @click.prevent="$router.replace({ path: `/` })"> 回到首页 </a>
  </div>
</template>
