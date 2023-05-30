<script lang="ts" setup>
import ActionCard from '@/components/ActionCard.vue';
import AttrCard from '@/components/AttrCard.vue';
import ScreenshotCard from '@/components/ScreenshotCard.vue';
import WindowCard from '@/components/WindowCard.vue';
import { Selector } from '@/selector_core';
import { delay, toNodeTree } from '@/utils';
import { message } from '@/utils/discrete';
import { errorTry, errorWrap } from '@/utils/error';
import { NodeOption } from '@/utils/selector';
import { storage } from '@/utils/storage';
import type { NaiveNode, SnapshotExt } from '@/utils/types';
import { Snapshot } from '@/utils/types';
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NInput,
  NInputGroup,
  NSpace,
  NSwitch,
  NRadioGroup,
  NRadio,
} from 'naive-ui';
import { computed, shallowReactive, shallowRef, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const snapshotId = computed(() => String(route.params.snapshotId || ``));

const screenshotUrl = shallowRef(``);
const snapshot = shallowRef<Snapshot>();

watchEffect(async () => {
  const localSnapshot = await storage.getSnapshot(snapshotId.value);
  if (!localSnapshot) {
    message.error(`数据缺失`);
    return;
  }
  const bf = await storage.getScreenshot(snapshotId.value);
  if (!bf) {
    message.create(`数据缺失`);
    return;
  }
  screenshotUrl.value = URL.createObjectURL(new Blob([bf]));
  snapshot.value = localSnapshot;
  root.value = toNodeTree(
    localSnapshot.nodes.map((n) => ({
      ...n,
      attr: {
        ...n.attr,
        index: 0,
        depth: 0,
      },
    })),
  );
  windowX.value = {
    ...localSnapshot,
    node: root.value,
  };
});

const root = shallowRef<NaiveNode>();
const windowX = shallowRef<SnapshotExt>();
const focusNode = shallowRef<NaiveNode>();
// 节点存在层叠渲染的情况
const skipKeys = shallowRef<number[]>([]);

const nodeOption = computed(() => {
  if (!root.value) return;
  return new NodeOption(root.value);
});

const onDelete = async () => {
  message.success(`删除成功,即将回到首页`);
  await delay(2000);
  router.replace({
    path: `/`,
  });
};

const selectorText = shallowRef(``);
const selectorResults = shallowReactive<
  {
    selector: string | Selector;

    results: NaiveNode[];
  }[]
>([]);
const searchBySelector = errorTry(() => {
  if (!nodeOption.value || !root.value) {
    message.error(`根节点不存在`);
    return;
  }
  const text = selectorText.value.trim();
  if (!text) return;

  if (enableSearchBySelector.value) {
    if (
      selectorResults.find(
        (s) => typeof s.selector == 'object' && s.selector.toString() == text,
      )
    ) {
      message.warning(`不可重复选择`);
      return;
    }
    const selector = errorWrap(() => Selector.parse(text), `选择器非法`);
    const results = nodeOption.value
      .querySelectorAll(selector)
      .map((s) => s.value)
      .toList();
    if (results.length == 0) {
      message.success(`没有选择到节点`);
      return;
    }
    message.success(`选择到 ${results.length} 个节点`);
    selectorResults.push({ selector, results });
  } else {
    if (
      selectorResults.find(
        (s) => typeof s.selector == 'string' && s.selector.toString() == text,
      )
    ) {
      message.warning(`不可重复选择`);
      return;
    }
    const results: NaiveNode[] = [];
    const stack: NaiveNode[] = [root.value];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.label.includes(text)) {
        results.push(n);
      }
      stack.push(...[...n.children].reverse());
    }
    if (results.length == 0) {
      message.success(`没有搜索到节点`);
      return;
    }
    message.success(`搜索到 ${results.length} 个节点`);
    selectorResults.push({ selector: text, results });
  }
});
const enableSearchBySelector = shallowRef(false);
</script>
<template>
  <div class="h-[calc(100%-10px)]" flex gap-5px p-5px>
    <ScreenshotCard
      v-if="screenshotUrl"
      :skip-keys="skipKeys"
      :url="screenshotUrl"
      :node="root"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
    />
    <WindowCard
      v-if="windowX"
      :window-x="windowX"
      :focus-node="focusNode"
      @update:focus-node="focusNode = $event"
      :skip-keys="skipKeys"
      @update:skip-keys="skipKeys = $event"
      class="flex-1"
    >
      <ActionCard
        v-if="snapshot"
        :snapshot="snapshot"
        @delete="onDelete"
        :show-preview="false"
      />
    </WindowCard>
    <AttrCard
      v-if="focusNode"
      :attr="focusNode.value.attr"
      class="fixed top-90px right-30px max-w-600px"
    />
    <div fixed top-100px right-480px w-420px bg-white>
      <NRadioGroup v-model:value="enableSearchBySelector">
        <NSpace>
          <NRadio :value="false"> 字符搜索 </NRadio>
          <NRadio :value="true"> 选择器查询 </NRadio>
        </NSpace>
      </NRadioGroup>
      <div m-t-4px></div>
      <NInputGroup>
        <NInput
          v-model:value="selectorText"
          placeholder="请输入选择器"
          @keyup.enter="searchBySelector"
        ></NInput>
        <NButton @click="searchBySelector">
          {{ enableSearchBySelector ? `查询` : `搜索` }}
        </NButton>
      </NInputGroup>
      <div p-5px></div>
      <NCollapse>
        <NCollapseItem
          v-for="(selectorResult, index) in selectorResults"
          :key="selectorResult.selector.toString()"
          :title="
            (typeof selectorResult.selector == 'string'
              ? `字符搜索`
              : `选择器查询`) +
            `：` +
            selectorResult.selector.toString()
          "
        >
          <template #header-extra>
            {{ selectorResult.results.length + `个节点` }}
            <div p-l-8px></div>
            <NButton @click.stop="selectorResults.splice(index, 1)">
              删除
            </NButton>
          </template>
          <NSpace style="max-height: 400px; overflow-y: scroll">
            <NButton
              v-for="resultNode in selectorResult.results"
              :key="resultNode.key"
              @click="focusNode = resultNode"
              size="small"
            >
              {{ resultNode.label }}
            </NButton>
          </NSpace>
        </NCollapseItem>
      </NCollapse>
    </div>
  </div>
</template>
