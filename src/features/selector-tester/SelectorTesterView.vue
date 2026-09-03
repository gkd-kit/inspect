<script setup lang="ts">
import GkSvg from '@/shared/ui/GkSvg.vue';
import SelectorText from '@/entities/selector/ui/SelectorText.vue';
import {
  AstNode,
  GkdException,
  Selector,
  SyntaxException,
} from '@gkd-kit/selector';
import { normalizeSelectorErrorIndex } from '@/entities/selector/parser';
import PageBackButton from '@/features/navigation/PageBackButton.vue';
import * as base64url from 'universal-base64url';

const route = useRoute();
const router = useRouter();

const getTextFromRoute = (value: unknown) => {
  const t = String(value || '');
  if (!t) return t;
  try {
    return base64url.decode(t);
  } catch {
    return '';
  }
};
const setTextToRoute = async (value: string) => {
  await router.replace({
    query: { gkd: value ? base64url.encode(value) : undefined },
  });
};

const initialText = getTextFromRoute(route.query.gkd);
const inputText = shallowRef(initialText);
const text = shallowRef(initialText.trim());
let inputRevision = 0;
const applyInputText = useDebounceFn(
  async (revision: number, value: string) => {
    if (revision != inputRevision) return;
    text.value = value.trim();
    await setTextToRoute(text.value);
  },
  500,
);
const updateInputText = (value: string) => {
  inputText.value = value;
  void applyInputText(++inputRevision, value);
};
const loadTextFromRoute = (value: unknown) => {
  const nextText = getTextFromRoute(value);
  if (nextText == inputText.value && nextText.trim() == text.value) return;
  inputRevision += 1;
  inputText.value = nextText;
  text.value = nextText.trim();
};
onBeforeRouteUpdate((to) => loadTextFromRoute(to.query.gkd));
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
    const errorIndex = normalizeSelectorErrorIndex(t, e.index);
    if (errorIndex == null) return;
    return {
      headText: t.substring(0, errorIndex),
      errorText: t.substring(errorIndex, errorIndex + 1),
      tailText: t.substring(errorIndex + 1),
      message: e.outMessage,
    };
  }
  return undefined;
});
</script>
<template>
  <div flex items-center gap-16px pt-12px px-12px>
    <PageBackButton />
    <div flex gap-16px items-center>
      <div text-18px>测试选择器</div>
      <div>语法高亮/错误解析</div>
    </div>
  </div>
  <div flex flex-col items-center p-8px text="40px/52px">
    <NInput
      :value="inputText"
      type="textarea"
      placeholder="请输入选择器"
      class="gkd_code py-4px"
      style="--n-font-size: 20px; --n-line-height-textarea: 28px"
      :autosize="{
        minRows: 3,
        maxRows: 8,
      }"
      @update:value="updateInputText"
    />
    <div h-20px />
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
          <span v-else pl-20px />
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
            <GkSvg name="arrow" class="text-18px color-dark" />
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
