<script setup lang="tsx">
import { getAppInfo, getDevice, getNodeLabel } from '@/utils/node';
import { buildEmptyFn, copy, delay } from '@/utils/others';
import type { RawNode, Snapshot } from '@/utils/types';
import type { TreeInst } from 'naive-ui';
import {
  NEllipsis,
  NTable,
  NTbody,
  NTd,
  NTh,
  NThead,
  NTooltip,
  NTr,
  NTree,
  NIcon,
} from 'naive-ui';
import type { HTMLAttributes } from 'vue';
import { computed, nextTick, shallowRef, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    snapshot: Snapshot;
    rootNode: RawNode;
    focusNode?: RawNode;
    focusCount: number;
    onUpdateFocusNode?: (data: RawNode) => void;
  }>(),
  {
    onUpdateFocusNode: buildEmptyFn,
  },
);

const expandedKeys = shallowRef<number[]>([]);
watch([() => props.focusNode, () => props.focusCount], async () => {
  if (!props.focusNode) return;
  const key = props.focusNode.id;
  nextTick().then(async () => {
    await delay(100);
    if (key === props.focusNode?.id) {
      treeRef.value?.scrollTo({ key, behavior: 'smooth', debounce: true });
    }
  });
  let parent = props.focusNode.parent;
  if (!parent) {
    return;
  }
  const s = new Set(expandedKeys.value);
  while (parent) {
    s.add(parent.id);
    parent = parent.parent;
  }
  if (
    s.size == expandedKeys.value.length &&
    expandedKeys.value.every((v) => s.has(v))
  ) {
    return;
  }
  expandedKeys.value = [...s];
});

const treeRef = shallowRef<TreeInst>();

const treeFilter = (pattern: string, node: RawNode) => {
  return node.id === props.focusNode?.id;
};
const treeNodeProps = (info: {
  option: RawNode;
}): HTMLAttributes & Record<string, unknown> => {
  const qf = info.option.idQf || info.option.textQf || info.option.quickFind;
  return {
    onClick: () => {
      props.onUpdateFocusNode(info.option);
    },
    style: {
      color: info.option.id == props.focusNode?.id ? `#00F` : undefined,
      fontWeight: qf ? `bold` : undefined,
    },
  };
};

const renderLabel = (info: {
  option: RawNode;
  checked: boolean;
  selected: boolean;
}) => {
  return getNodeLabel(info.option);
};

const isSystem = computed(() => {
  return getAppInfo(props.snapshot).isSystem;
});
</script>

<template>
  <div flex flex-col>
    <NTable
      size="small"
      striped
      :singleLine="false"
      :themeOverrides="{
        thPaddingSmall: '2px 6px',
        tdPaddingSmall: '2px 6px',
      }"
    >
      <NThead>
        <NTr>
          <NTh> 设备 </NTh>
          <NTh> 应用名称 </NTh>
          <NTh> 版本名称 </NTh>
          <NTh> 版本代码 </NTh>
          <NTh> 应用ID </NTh>
          <NTh> 界面ID </NTh>
          <NTh> 操作 </NTh>
        </NTr>
      </NThead>
      <NTbody>
        <NTr>
          <NTd class="whitespace-nowrap w-0">
            {{
              `${getDevice(snapshot).manufacturer} Android ${
                getDevice(snapshot).release || ``
              }`
            }}
          </NTd>
          <NTd
            class="whitespace-nowrap"
            @click="copy(getAppInfo(snapshot).name)"
          >
            <div flex items-center gap-2px max-w-120px>
              <NTooltip v-if="isSystem">
                <template #trigger>
                  <NIcon :size="14">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      xmlns:xlink="http://www.w3.org/1999/xlink"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19.43 12.98c.04-.32.07-.64.07-.98c0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.566.566 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98c0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73c0 .21-.02.43-.05.73l-.14 1.13l.89.7l1.08.84l-.7 1.21l-1.27-.51l-1.04-.42l-.9.68c-.43.32-.84.56-1.25.73l-1.06.43l-.16 1.13l-.2 1.35h-1.4l-.19-1.35l-.16-1.13l-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7l-1.06.43l-1.27.51l-.7-1.21l1.08-.84l.89-.7l-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13l-.89-.7l-1.08-.84l.7-1.21l1.27.51l1.04.42l.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43l.16-1.13l.2-1.35h1.39l.19 1.35l.16 1.13l1.06.43c.43.18.83.41 1.23.71l.91.7l1.06-.43l1.27-.51l.7 1.21l-1.07.85l-.89.7l.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"
                        fill="currentColor"
                      ></path>
                    </svg>
                  </NIcon>
                </template>
                系统应用
              </NTooltip>
              <NEllipsis>
                {{ getAppInfo(snapshot).name }}
              </NEllipsis>
            </div>
          </NTd>
          <NTd
            class="whitespace-nowrap"
            @click="copy(getAppInfo(snapshot).versionName)"
          >
            <NEllipsis>
              {{ getAppInfo(snapshot).versionName }}
            </NEllipsis>
          </NTd>
          <NTd
            class="whitespace-nowrap"
            @click="copy(getAppInfo(snapshot).versionCode.toString())"
          >
            <NEllipsis>
              {{ getAppInfo(snapshot).versionCode }}
            </NEllipsis>
          </NTd>
          <NTd
            class="whitespace-nowrap max-w-[max(12vw,180px)]"
            @click="copy(snapshot.appId)"
          >
            <NEllipsis>
              {{ snapshot.appId }}
            </NEllipsis>
          </NTd>
          <NTd
            @click="copy(snapshot.activityId)"
            class="break-words max-w-[max(15vw,200px)] text-left direction-rtl"
          >
            <NEllipsis>
              {{ snapshot.activityId }}
            </NEllipsis>
          </NTd>
          <NTd>
            <slot></slot>
          </NTd>
        </NTr>
      </NTbody>
    </NTable>
    <NTree
      ref="treeRef"
      virtualScroll
      showLine
      keyField="id"
      v-model:expandedKeys="expandedKeys"
      :data="[rootNode as any]"
      :filter="(treeFilter as any)"
      :nodeProps="(treeNodeProps as any)"
      :renderLabel="(renderLabel as any)"
    />
    <div h-20px></div>
  </div>
</template>
