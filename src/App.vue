<script setup lang="ts">
import { NConfigProvider, NModal, dateZhCN, zhCN } from 'naive-ui';
import { RouterView } from 'vue-router';
import store from './utils/store';
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" abstract>
    <NModal
      v-model:show="store.githubErrorDlgVisible"
      preset="dialog"
      title="生成分享链接失败"
    >
      <div>生成分享链接需要以下条件</div>
      <div>
        在当前浏览器登录
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">
          github.com
        </a>
      </div>
    </NModal>
    <NModal
      v-model:show="store.networkErrorDlgVisible"
      preset="dialog"
      title="访问其它域名资源失败"
    >
      <div>访问其它域名资源需要以下条件</div>
      <div>
        1. 安装脚本管理器, 如
        <a
          href="https://violentmonkey.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Violentmonkey
        </a>
        或
        <a
          href="https://www.tampermonkey.net/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Tampermonkey
        </a>
      </div>
      <div>
        2. 安装油猴脚本
        <a
          href="https://github.com/gkd-kit/network-extension"
          target="_blank"
          rel="noopener noreferrer"
        >
          network-extension
        </a>
      </div>
      <div>3. 在当前网站启用上述油猴脚本的API注入功能</div>
      <div>
        4. 如果是分享链接则需要在当前浏览器登录
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">
          github.com
        </a>
      </div>
    </NModal>
    <RouterView />
  </NConfigProvider>
</template>

<style scoped lang="scss"></style>
<style lang="scss">
#app {
  min-width: 1200px;
  min-height: 700px;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}
.gkd_code {
  font-family: v-mono, SFMono-Regular, Menlo, Consolas, Courier, monospace;
}
</style>
