import { message } from '@/shared/services/feedback';
import { delay } from './async';

export const copy = (() => {
  let lastText: string | undefined;
  return async (text?: string) => {
    if (!text || lastText === text) return;
    lastText = text;
    void delay(10_000).then(() => {
      lastText = undefined;
    });
    try {
      await navigator.clipboard.writeText(text);
      message.success('复制成功');
    } catch {
      message.error('复制失败');
    }
  };
})();
