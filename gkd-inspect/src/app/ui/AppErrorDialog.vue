<script setup lang="ts">
import { useNetworkAccessStore } from '@/features/network-access/store';

const networkAccessStore = useNetworkAccessStore();
</script>
<template>
  <NModal
    :show="networkAccessStore.state.githubErrorDialogVisible"
    preset="dialog"
    title="生成分享链接失败"
    type="error"
    @update:show="networkAccessStore.setGithubErrorDialogVisible"
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
    :show="networkAccessStore.state.networkErrorDialogVisible"
    preset="dialog"
    title="访问其它域名资源失败"
    type="error"
    @update:show="networkAccessStore.setNetworkErrorDialogVisible"
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
      4. 分享文件或导入快照额外需浏览器登录
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">
        github.com
      </a>
    </div>
  </NModal>
</template>
