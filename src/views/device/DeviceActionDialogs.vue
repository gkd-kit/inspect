<script setup lang="ts">
import { message } from '@/utils/discrete';
import { errorWrap } from '@/utils/error';
import { useTask } from '@/utils/task';
import JSON5 from 'json5';
import type { DeviceApi } from './api';
import SelectorLibraryDialog from '@/components/selector/SelectorLibraryDialog.vue';

const props = defineProps<{
  api: DeviceApi;
  selectorShow: boolean;
  subscriptionShow: boolean;
}>();

const emit = defineEmits<{
  'update:selectorShow': [show: boolean];
  'update:subscriptionShow': [show: boolean];
}>();

const subscriptionText = shallowRef(``);
const clickAction = shallowReactive({
  selector: ``,
  action: 'click',
  quickFind: false,
});
const updateSubscriptionText = (value: string) => {
  subscriptionText.value = value;
};
const updateSelector = (value: string) => {
  clickAction.selector = value;
};
const updateQuickFind = (value: boolean) => {
  clickAction.quickFind = value;
};
const updateAction = (value: string) => {
  clickAction.action = value;
};
const selectorLibraryShow = shallowRef(false);
const openSelectorLibrary = () => {
  selectorLibraryShow.value = true;
};
const setSelectorLibraryVisible = (show: boolean) => {
  selectorLibraryShow.value = show;
};
const useLibrarySelector = (selector: string) => {
  updateSelector(selector);
};

const actionOptions: { value?: string; label: string }[] = [
  { label: '仅查询', value: `` },
  { value: 'click', label: 'click' },
  { value: 'clickNode', label: 'clickNode' },
  { value: 'clickCenter', label: 'clickCenter' },
  { value: 'back', label: 'back' },
  { value: 'longClick', label: 'longClick' },
  { value: 'longClickNode', label: 'longClickNode' },
  { value: 'longClickCenter', label: 'longClickCenter' },
];

const updateSubscription = useTask(async () => {
  const data = errorWrap(() => JSON5.parse(subscriptionText.value.trim()));
  if (!data) return;
  if (data.categories || data.globalGroups || data.apps) {
    await props.api.updateSubscription(data);
  } else if (typeof data.id == 'string') {
    await props.api.updateSubscription({ apps: [data] });
  } else if (Array.isArray(data) && typeof data[0].id == 'string') {
    await props.api.updateSubscription({ apps: data });
  } else if (typeof data.key == 'number') {
    await props.api.updateSubscription({ globalGroups: [data] });
  } else if (Array.isArray(data) && typeof data[0].key == 'number') {
    await props.api.updateSubscription({ globalGroups: data });
  } else {
    message.error(`无法识别的订阅文本`);
    return;
  }
  message.success(`修改成功`);
});

const executeSelector = useTask(async () => {
  const result = await props.api.execSelector({
    ...clickAction,
    fastQuery: clickAction.quickFind,
  });
  if (result.message) {
    message.success(`操作成功:` + result.message);
    return;
  }
  if (result.action) {
    message.success((result.result ? `操作成功:` : `操作失败`) + result.action);
  } else if (result.result) {
    message.success(`查询成功`);
  }
});

const subscriptionPlaceholder = `
请输入订阅文本(JSON5语法):
示例1-更新单个应用的规则:
{
  id: 'appId',
  groups: []
}

示例2-更新多个应用的规则:
[
  {
    id: 'appId1',
    groups: []
  },
  {
    id: 'appId2',
    groups: []
  }
]

示例3-更新全局规则(1.7.0):
{
  name: '全局规则-1',
  key: 0,
  rules: []
}

示例3-更新多个全局规则(1.7.0):
[
  {
    name: '全局规则-1',
    key: 0,
    rules: []
  },
  {
    name: '全局规则-2',
    key: 1,
    rules: []
  }
]

示例4-更新整个订阅(1.7.0):
{
  apps: [],
  globalGroups: [],
  categories: [],
}
`.trim();
</script>

<template>
  <NModal
    :show="subscriptionShow"
    preset="dialog"
    style="width: 800px"
    title="修改内存订阅"
    :maskClosable="false"
    positiveText="确认"
    :positiveButtonProps="{
      loading: updateSubscription.loading,
      onClick: updateSubscription.invoke,
    }"
    @update:show="emit('update:subscriptionShow', $event)"
  >
    <NInput
      :value="subscriptionText"
      :disabled="updateSubscription.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{ minRows: 20, maxRows: 25 }"
      :placeholder="subscriptionPlaceholder"
      @update:value="updateSubscriptionText"
    />
  </NModal>

  <NModal
    :show="selectorShow"
    preset="dialog"
    style="width: 800px"
    title="执行选择器"
    :maskClosable="false"
    positiveText="确认"
    :positiveButtonProps="{
      loading: executeSelector.loading,
      onClick: executeSelector.invoke,
    }"
    @update:show="emit('update:selectorShow', $event)"
  >
    <NInput
      :value="clickAction.selector"
      :disabled="executeSelector.loading"
      type="textarea"
      class="gkd_code"
      :autosize="{ minRows: 4, maxRows: 10 }"
      placeholder="请输入合法的选择器"
      @update:value="updateSelector"
    />
    <div class="mt-8px flex justify-end">
      <NButton secondary @click="openSelectorLibrary">选择器库</NButton>
    </div>
    <div h-15px />
    <NSpace>
      <NCheckbox
        :checked="clickAction.quickFind"
        @update:checked="updateQuickFind"
      >
        快速查找
      </NCheckbox>
      <a
        href="https://gkd.li/api/interfaces/RawCommonProps.html#quickfind"
        target="_blank"
        rel="noopener noreferrer"
      >
        查找说明
      </a>
    </NSpace>
    <div h-10px />
    <div flex gap-10px flex-items-center>
      <NSelect
        :value="clickAction.action"
        :options="actionOptions"
        class="w-150px"
        @update:value="updateAction"
      />
      <a
        href="https://gkd.li/api/interfaces/RawRuleProps#action"
        target="_blank"
        rel="noopener noreferrer"
      >
        操作说明
      </a>
    </div>
  </NModal>
  <SelectorLibraryDialog
    :show="selectorLibraryShow"
    @use="useLibrarySelector"
    @update:show="setSelectorLibraryVisible"
  />
</template>
