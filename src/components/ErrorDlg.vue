<script setup lang="ts">
import { settingsStorage } from '@/utils/storage';
import store from '@/utils/store';
</script>
<template>
  <NModal
    v-model:show="store.githubErrorDlgVisible"
    preset="dialog"
    title="生成分享链接失败"
    type="success"
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
    type="success"
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
      4. 如果是分享链接则需要在当前浏览器登录
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">
        github.com
      </a>
    </div>
  </NModal>
  <NModal
    v-model:show="store.wasmErrorDlgVisible"
    preset="dialog"
    title="浏览器不支持或版本过低"
    type="warning"
    positiveText="确定"
  >
    <div>
      选择器的正则表达式一致性需要使用
      <a
        href="https://developer.chrome.com/blog/wasmgc?hl=zh-cn"
        target="_blank"
        rel="noopener noreferrer"
        >WASM(GC)</a
      >
    </div>
    <div mt-10px>请使用 Chrome119/Edge119/Firefox120 或最新版本</div>
    <NCheckbox class="mt-10px" v-model:checked="settingsStorage.ignoreWasmWarn">
      不关注一致性, 不再提醒
    </NCheckbox>
  </NModal>
</template>
