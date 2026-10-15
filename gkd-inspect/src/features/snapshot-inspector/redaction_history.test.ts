import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RedactionRect } from './privacy_redaction.ts';
import {
  commitRedactionRectangles,
  createRedactionHistory,
  getRedactionHistoryCommand,
  redoRedactionHistory,
  undoRedactionHistory,
} from './redaction_history.ts';

const firstRect: RedactionRect = { left: 1, top: 2, right: 3, bottom: 4 };
const secondRect: RedactionRect = { left: 5, top: 6, right: 7, bottom: 8 };

test('uses undo and redo stacks for redaction states', () => {
  let history = createRedactionHistory();
  history = commitRedactionRectangles(history, [firstRect]);
  history = commitRedactionRectangles(history, [firstRect, secondRect]);
  history = undoRedactionHistory(history);
  assert.deepEqual(history.rectangles, [firstRect]);
  assert.equal(history.redoStack.length, 1);

  history = redoRedactionHistory(history);
  assert.deepEqual(history.rectangles, [firstRect, secondRect]);
  assert.equal(history.redoStack.length, 0);
});

test('clearing is undoable and a new edit clears the redo stack', () => {
  let history = commitRedactionRectangles(createRedactionHistory(), [
    firstRect,
  ]);
  history = commitRedactionRectangles(history, []);
  history = undoRedactionHistory(history);
  assert.deepEqual(history.rectangles, [firstRect]);

  history = commitRedactionRectangles(history, [firstRect, secondRect]);
  assert.equal(history.redoStack.length, 0);
});

test('maps common undo and redo shortcuts', () => {
  const event = (
    key: string,
    options: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>>,
  ) => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...options,
  });

  assert.equal(
    getRedactionHistoryCommand(event('z', { ctrlKey: true })),
    'undo',
  );
  assert.equal(
    getRedactionHistoryCommand(event('z', { metaKey: true })),
    'undo',
  );
  assert.equal(
    getRedactionHistoryCommand(event('y', { ctrlKey: true })),
    'redo',
  );
  assert.equal(
    getRedactionHistoryCommand(event('z', { metaKey: true, shiftKey: true })),
    'redo',
  );
  assert.equal(getRedactionHistoryCommand(event('z', {})), undefined);
});
