<script setup lang="ts">
import { useThrottle } from '@/utils';
import { useDeviceApi } from '@/utils/api';
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import storage from '@/utils/storage';
import type { Device } from '@/utils/types';
import { NButton, NInput, NInputGroup, NSpace } from 'naive-ui';
import { ref } from 'vue';

const { api, origin } = useDeviceApi();
const link = ref(``);
const device = ref<Device>();
const connect = useThrottle(async () => {
  origin.value = errorWrap(
    () => new URL(link.value.trim()),
    () => `非法设备地址`,
  ).origin;
  link.value = origin.value;
  device.value = await api.device();
});
const captureSnapshot = useThrottle(async () => {
  const snapshot = await api.capture();
  message.success(`抓取快照成功`);
  await Promise.all([
    storage.setSnapshot(snapshot),
    storage.setWindow(snapshot.id, await api.window({ id: snapshot.id })),
    api.screenshot({ id: snapshot.id }).then((screenshot) => {
      return storage.setScreenshot(snapshot.id, screenshot);
    }),
  ]);
  message.success(`保存快照成功`);
});
</script>
<template>
  <div flex flex-col p-10px>
    <NSpace>
      <NInputGroup>
        <NInput
          v-model:value="link"
          placeholder="请输入设备地址"
          :style="{ minWidth: `250px` }"
          @keyup.enter="connect.invoke"
        ></NInput>
        <NButton ghost @click="connect.invoke" :loading="connect.loading">
          连接
        </NButton>
      </NInputGroup>
      <template v-if="device">
        <div class="h-100%" flex flex-items-center>
          {{ `已连接 ${device.manufacturer} Android ${device.release}` }}
        </div>
        <NButton
          v-if="device"
          ghost
          @click="captureSnapshot.invoke"
          :loading="captureSnapshot.loading"
        >
          快照
        </NButton>
      </template>
    </NSpace>
  </div>
</template>
