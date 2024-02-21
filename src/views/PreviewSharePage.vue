<script setup lang="ts">
import { toValidURL } from '@/utils/check';
import { loadingBar } from '@/utils/discrete';
import { enhanceFetch } from '@/utils/fetch';
import { copy, timeAgo, useAdaptMobile } from '@/utils/others';
import JSON5 from 'json5';
import { NButton, NIcon, NInput } from 'naive-ui';
import { computed, shallowRef, watchEffect } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
useAdaptMobile();

const url = computed(() => {
  const u = toValidURL(String(route.query.url));
  if (u) {
    return u;
  }
  const github_asset_id = String(route.params.github_asset_id);
  return new URL(
    `https://github.com/gkd-kit/inspect/files/${github_asset_id}/file.txt`,
  );
});
// http://127.0.0.1:8444/s/14332516
const data = shallowRef<{
  data: unknown;
  ctime: number;
}>();
const error = shallowRef('');
const dataString = computed(() => {
  if (!data.value?.data) return '';
  return JSON5.stringify(data.value?.data, null, 2);
});
const loading = shallowRef(true);
watchEffect(async () => {
  loading.value = true;
  try {
    loadingBar.start();
    const text = await enhanceFetch(url.value.href, undefined, {
      proxy: true,
    }).then((r) => r.text());
    if (text == 'Not Found') {
      throw new Error('Not Found');
    }
    data.value = JSON5.parse(text);
    if (data.value?.ctime && data.value?.data) {
      loadingBar.finish();
    } else {
      throw new Error(text);
    }
  } catch (e) {
    loadingBar.error();
    if (e instanceof Error) {
      error.value = e.message;
    } else {
      error.value = String(e || 'unknown error');
    }
  }
  loading.value = false;
});
const openGkd = () => {
  const u = new URL('gkd://import');
  u.searchParams.set('url', url.value.href);
  location.href = u.href;
};
</script>
<template>
  <div v-if="loading" pt-40px text-center>加载中...</div>
  <div v-else-if="error" pt-40px text-center>
    <div>解析失败</div>
    <div>{{ error }}</div>
  </div>
  <div
    v-else-if="data && dataString"
    p-20px
    flex
    flex-col
    gap-20px
    h-full
    relative
  >
    <div flex flex-items-center gap-10px>
      <div font-bold>规则预览</div>
      <div>{{ timeAgo(data.ctime) }}</div>
      <div flex-1></div>
      <NButton
        text
        tag="a"
        href="https://gkd.li/guide/"
        target="_blank"
        type="primary"
      >
        下载 GKD
      </NButton>
    </div>
    <NInput
      class="flex-1 gkd_code"
      type="textarea"
      show-count
      :value="dataString"
    >
      <template #suffix>
        <div h-full relative>
          <NButton
            class="absolute right-0 top-10px"
            size="small"
            @click="copy(dataString)"
          >
            <template #icon>
              <NIcon>
                <svg viewBox="0 0 24 24">
                  <path
                    d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                    fill="currentColor"
                  ></path>
                </svg>
              </NIcon>
            </template>
          </NButton>
        </div>
      </template>
    </NInput>
    <NButton @click="openGkd"> 导入 GKD </NButton>
  </div>
</template>
