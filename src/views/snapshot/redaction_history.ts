import type { RedactionRect } from './privacy_redaction.ts';

export interface RedactionHistory {
  undoStack: RedactionRect[][];
  rectangles: RedactionRect[];
  redoStack: RedactionRect[][];
}

export type RedactionHistoryCommand = 'undo' | 'redo';

export const createRedactionHistory = (): RedactionHistory => ({
  undoStack: [],
  rectangles: [],
  redoStack: [],
});

export const commitRedactionRectangles = (
  history: RedactionHistory,
  rectangles: RedactionRect[],
): RedactionHistory => ({
  undoStack: [...history.undoStack, history.rectangles],
  rectangles,
  redoStack: [],
});

export const undoRedactionHistory = (
  history: RedactionHistory,
): RedactionHistory => {
  const previous = history.undoStack.at(-1);
  if (!previous) return history;
  return {
    undoStack: history.undoStack.slice(0, -1),
    rectangles: previous,
    redoStack: [...history.redoStack, history.rectangles],
  };
};

export const redoRedactionHistory = (
  history: RedactionHistory,
): RedactionHistory => {
  const next = history.redoStack.at(-1);
  if (!next) return history;
  return {
    undoStack: [...history.undoStack, history.rectangles],
    rectangles: next,
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const getRedactionHistoryCommand = (
  event: Pick<
    KeyboardEvent,
    'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'
  >,
): RedactionHistoryCommand | undefined => {
  if (event.altKey || (!event.ctrlKey && !event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key == 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key == 'y' && !event.shiftKey) return 'redo';
};
