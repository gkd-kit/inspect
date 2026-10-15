import type { Directive } from 'vue';

export const vRect: Directive<HTMLElement, (rect: DOMRect) => void> = {
  async mounted(el, binding) {
    await nextTick();
    binding.value(el.getClientRects()[0]);
  },
  async updated(el, binding) {
    await nextTick();
    binding.value(el.getClientRects()[0]);
  },
};
