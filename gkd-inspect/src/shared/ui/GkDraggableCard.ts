export interface GkDraggableCardValue {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
}

interface DraggableViewportSize {
  width: number;
  height: number;
}

interface DraggableViewportRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const getDraggableViewportCorrection = (
  rect: DraggableViewportRect,
  viewport: DraggableViewportSize,
  minVisible = 40,
) => {
  let x = 0;
  let y = 0;
  if (rect.right < minVisible) x = minVisible - rect.right;
  else if (rect.left > viewport.width - minVisible) {
    x = viewport.width - minVisible - rect.left;
  }
  if (rect.bottom < minVisible) y = minVisible - rect.bottom;
  else if (rect.top > viewport.height - minVisible) {
    y = viewport.height - minVisible - rect.top;
  }
  return { x, y };
};

export const getDraggableViewportWidth = (
  width: number,
  viewportWidth: number,
  minWidth = 0,
  margin = 24,
) => Math.min(width, Math.max(minWidth, viewportWidth - margin));

export const useDragMove = (
  xFilter: (x: number) => boolean,
  onEnd?: () => void,
) => {
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
  const cancelMove = () => {
    prevEv = undefined;
  };
  const endMove = () => {
    if (!target.value || !prevEv) return;
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
    cancelMove();
    onEnd?.();
  };
  onMounted(() => {
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', endMove);
    document.addEventListener('selectstart', preventSelection);
  });
  onUnmounted(() => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', endMove);
    document.removeEventListener('selectstart', preventSelection);
    target.value?.removeEventListener('pointerdown', startMove);
    cancelMove();
  });
  watch(target, (newValue, oldValue) => {
    if (newValue) {
      newValue.addEventListener('pointerdown', startMove);
    }
    if (oldValue) {
      oldValue.removeEventListener('pointerdown', startMove);
    }
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
