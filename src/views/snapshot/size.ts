const windowSize = useWindowSize();
export const vw = computed(() => windowSize.width.value / 100);
// const vh = computed(() => windowSize.width.value / 100);

// --gkd-w: max(1200px, 100vw);
export const gkdWidth = computed(() => Math.max(1200, windowSize.width.value));

// --gkd-h: max(700px, 100vh);
export const gkdHeight = computed(() => Math.max(700, windowSize.height.value));
