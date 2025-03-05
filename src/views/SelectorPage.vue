<script setup lang="ts">
import SelectorText from '@/components/SelectorText.vue';
import { useAutoHeight, useAutoWidth } from '@/utils/others';
import {
  AstNode,
  Selector,
  GkdException,
  SyntaxException,
} from '@gkd-kit/selector';
import * as base64url from 'universal-base64url';

useAutoHeight();
useAutoWidth();

const route = useRoute();
const router = useRouter();

const getTextFromRoute = () => {
  const t = String(route.query.gkd || '');
  if (!t) return t;
  try {
    return base64url.decode(t);
  } catch (e) {
    setTextToRoute('');
    return '';
  }
};
const setTextToRoute = (t: string) => {
  router.replace({ query: { gkd: t ? base64url.encode(t) : undefined } });
};

const inputText = shallowRef(getTextFromRoute());
const lazyText = useDebounce(inputText, 500);
const text = computed(() => {
  return (inputText.value && lazyText.value).trim();
});
watch(text, () => {
  setTextToRoute(text.value);
});
const result = computed(() => {
  if (!text.value) return;
  try {
    return Selector.Companion.parseAst(text.value);
  } catch (e) {
    return e as GkdException;
  }
});

const ast = computed(() => {
  if (result.value instanceof AstNode) {
    return result.value;
  }
  return undefined;
});

const error = computed(() => {
  const e = result.value;
  const t = text.value;
  if (e instanceof SyntaxException) {
    return {
      headText: t.substring(0, e.index),
      errorText: t.substring(e.index, e.index + 1),
      tailText: t.substring(e.index + 1),
      message: e.outMessage,
    };
  }
  return undefined;
});
</script>
<template>
  <div flex items-center gap-16px pt-12px px-12px>
    <NTooltip placement="right">
      <template #trigger>
        <NButton text>
          <template #icon>
            <RouterLink to="/" color="inherit">
              <NIcon size="24">
                <SvgIcon name="home" />
              </NIcon>
            </RouterLink>
          </template>
        </NButton>
      </template>
      回到首页
    </NTooltip>
    <div flex gap-16px>
      <div text-18px>测试选择器</div>
      <div>语法高亮/错误解析</div>
    </div>
  </div>
  <div flex flex-col items-center p-8px text="40px/52px">
    <NInput
      v-model:value="inputText"
      type="textarea"
      placeholder="请输入选择器"
      class="gkd_code py-4px"
      style="--n-font-size: 20px; --n-line-height-textarea: 28px"
      :autosize="{
        minRows: 3,
        maxRows: 8,
      }"
    />
    <div h-20px></div>
    <div
      max-w-full
      mb-8px
      p-4px
      gkd_code
      transition-colors
      :class="error ? `bg-red-200` : `bg-light-600`"
    >
      <div v-if="ast" overflow-x-scroll scrollbar-hidden>
        <SelectorText :source="text" :node="ast" />
      </div>
      <span v-else-if="error" whitespace-pre-wrap>
        <span v-if="error.headText">{{ error.headText }}</span>
        <span bg-red relative>
          <span v-if="error.errorText">{{ error.errorText }}</span>
          <span v-else pl-20px></span>
          <div
            absolute
            left-0
            right-0
            top--12px
            flex
            flex-col
            items-center
            animate-bounce
            pointer-events-none
          >
            <SvgIcon name="arrow" class="text-18px color-dark" />
          </div>
        </span>
        <span v-if="error.tailText">{{ error.tailText }}</span>
      </span>
    </div>
    <div v-if="error" p-4px bg-red-300 gkd_code>
      {{ error.message }}
    </div>
  </div>
</template>
