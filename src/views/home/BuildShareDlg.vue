<script setup lang="tsx">
import { uploadAsset } from '@/utils/github';
import { copy } from '@/utils/others';
import { useTask } from '@/utils/task';
import QRCode from 'qrcode';

const router = useRouter();

const show = defineModel('show', { default: false });

const text = shallowRef('');

const disabled = shallowRef(false);
const checkJson = useDebounceFn(() => {
  try {
    JSON5.parse(text.value);
    disabled.value = false;
  } catch {
    disabled.value = true;
  }
}, 500);
watchEffect(() => {
  if (text.value.trim()) {
    checkJson();
  } else {
    disabled.value = true;
  }
});

const linkDlgShow = shallowRef(false);
const shareLink = shallowRef('');
const shareLinkQr = shallowRef('');
watchEffect(() => {
  if (shareLink.value) {
    QRCode.toDataURL(shareLink.value, { width: 256, margin: 2 }).then((url) => {
      shareLinkQr.value = url;
    });
  } else {
    shareLinkQr.value = '';
  }
});
const copyLink = () => {
  copy(shareLink.value);
  linkDlgShow.value = false;
};

const buildShare = useTask(async () => {
  const data = JSON5.parse(text.value);
  const asset = await uploadAsset(
    new TextEncoder().encode(
      JSON5.stringify({
        data,
        ctime: Date.now(),
        type: 'share',
      }),
    ),
    'file.txt',
  );
  const link = location.origin + router.resolve(`/s/${asset.id}`).href;
  shareLink.value = link;
  linkDlgShow.value = true;
});
</script>
<template>
  <NModal
    v-model:show="show"
    preset="dialog"
    title="分享规则"
    :positiveText="buildShare.loading ? '分享中...' : '分享'"
    @positiveClick="buildShare.invoke"
    :loading="buildShare.loading"
    :positiveButtonProps="{ disabled }"
    style="width: 800px"
    @afterLeave="text = ''"
  >
    <NInput
      class="gkd_code h-[calc(var(--gkd-height)*0.6)]"
      type="textarea"
      show-count
      :value="text"
      @update:value="
        if (!buildShare.loading) {
          text = $event;
        }
      "
      placeholder="请输入需要分享的规则"
    />
  </NModal>
  <NModal
    v-model:show="linkDlgShow"
    preset="dialog"
    title="分享成功"
    positiveText="复制并关闭"
    negativeText="重新分享"
    @positiveClick="copyLink"
    @negativeClick="
      linkDlgShow = false;
      text = '';
      show = true;
    "
    @afterLeave="shareLink = ''"
    :maskClosable="false"
  >
    <div>
      <NButton text tag="a" :href="shareLink" target="_blank" type="primary">
        {{ shareLink }}
      </NButton>
      <img v-if="shareLinkQr" :src="shareLinkQr" size-200px block />
    </div>
  </NModal>
</template>
