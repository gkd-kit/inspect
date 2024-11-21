export const useDragMove = (xFilter: (x: number) => boolean) => {
  const target = shallowRef<HTMLElement>();
  const prevOffset = {
    x: 0,
    y: 0,
  };

  const offset = shallowReactive({ ...prevOffset });
  let prevEv: PointerEvent | undefined = undefined;
  const preventSelection = (ev: Event) => {
    if (prevEv) {
      ev.preventDefault();
    }
  };
  const startMove = (ev: PointerEvent) => {
    prevEv = ev;
    prevOffset.x = offset.x;
    prevOffset.y = offset.y;
  };
  const move = (ev: PointerEvent) => {
    if (!prevEv || !target.value) return;

    const dx = ev.clientX - prevEv.clientX; // ev.movementX;
    const dy = ev.clientY - prevEv.clientY; //ev.movementY;

    if (xFilter(dx)) {
      offset.x = prevOffset.x + dx;
    }
    offset.y = prevOffset.y + dy;
  };
  const endMove = () => {
    prevEv = undefined;
  };
  const windowEndMove = () => {
    if (!target.value || !prevEv) return;
    endMove();
    const { top, bottom, left, right } = target.value.getBoundingClientRect();
    if (
      right < 0 ||
      left > window.innerWidth ||
      bottom < 0 ||
      top > window.innerHeight
    ) {
      // isOutsideViewport
      offset.x = prevOffset.x;
      offset.y = prevOffset.y;
    }
  };
  onMounted(() => {
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', windowEndMove);
    document.addEventListener('selectstart', preventSelection);
  });
  onUnmounted(() => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', windowEndMove);
    document.removeEventListener('selectstart', preventSelection);
    endMove();
  });
  watch(target, (newValue, oldValue) => {
    if (newValue) {
      newValue.addEventListener('pointerdown', startMove);
      newValue.addEventListener('pointerup', endMove);
    }
    if (oldValue) {
      oldValue.removeEventListener('pointerdown', startMove);
      oldValue.removeEventListener('pointerup', endMove);
    }
  });
  onUnmounted(() => {
    if (!target.value) return;
    target.value.removeEventListener('pointerdown', startMove);
    target.value.removeEventListener('pointerup', endMove);
  });
  return {
    target,
    offset,
  };
};

let currentMaxZIndex = 1000;
export const useZindex = () => {
  currentMaxZIndex++;
  const zIndex = shallowRef(currentMaxZIndex);
  const setTop = () => {
    if (zIndex.value === currentMaxZIndex) return;
    currentMaxZIndex++;
    zIndex.value = currentMaxZIndex;
  };
  return {
    zIndex,
    setTop,
  };
};
