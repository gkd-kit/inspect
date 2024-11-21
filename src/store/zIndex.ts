export const useZIndexStore = defineStore('zIndex', () => {
  const globalZIndex = shallowRef(1000);
  const zIndexMap = new Map<number, Ref<number>>();

  let size = 0;
  const useZindex = () => {
    size++;
    const key = size;
    if (!zIndexMap.has(key)) {
      zIndexMap.set(key, shallowRef(++globalZIndex.value));
    }
    const zIndex = zIndexMap.get(key)!;

    const setTop = () => {
      zIndex.value = ++globalZIndex.value;
    };

    onUnmounted(() => {
      zIndexMap.delete(key);
    });

    return {
      zIndex,
      setTop,
    };
  };

  return {
    useZindex,
  };
});
