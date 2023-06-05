import type { Directive } from 'vue';
import { nextTick } from 'vue';

export const rect: Directive<HTMLElement, (rect: DOMRect) => void> = {
  async mounted(el, binding) {
    await nextTick();
    binding.value(el.getClientRects()[0]);
  },
  async updated(el, binding) {
    await nextTick();
    binding.value(el.getClientRects()[0]);
  },
};
